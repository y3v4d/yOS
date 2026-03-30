import { IDBDriver } from "./idb_driver";
import type { Kernel } from "./kernel";

enum FileType {
    FILE = 0,
    DIRECTORY = 1
}

type INode = {
    id: number;

    type: FileType;
    size: number;

    created_at: number;
    modified_at: number;
}

type Block = Uint8Array;

type DirBlock = {
    [name: string]: number; // name to inode mapping
}

type FileDescriptor = {
    id: number;

    inode: number;
    position: number;

    fsnotify_group: FsNotifyGroup;

    type: "file" | "inotify";
}

type DirDescriptor = {
    id: number;
    inode: number;

    entries: DirEntry[];
    position: number;
}

type DirEntry = {
    inode: number;
    type: FileType;

    name: string;
}

enum FsNotifyEventType {
    CREATE      = 0b00000001,
    DELETE      = 0b00000010,
    MODIFY      = 0b00000100,
    RENAME      = 0b00001000,
    DELETE_SELF = 0b00010000,
    ISDIR       = 0b00100000
}

interface FsNotifyEvent {
    watcher: number;
    type: FsNotifyEventType;

    name: string;
}

interface FsNotifyWatcher {
    id: number;
    group: FsNotifyGroup;

    mask: number;
    inode: INode;
}

interface FsNotifyGroup {
    notification_waitq: (() => void)[];
    events: FsNotifyEvent[];
    watchers: FsNotifyWatcher[];

    closed?: boolean;
}

class VFS {
    private _driver: IDBDriver = null!;

    private _inodeCache: Map<number, INode> = new Map();
    private _blockCache: Map<number, Block> = new Map();

    private _inodeWatchers: Map<number, Set<FsNotifyWatcher>> = new Map();

    private _nextInodeNum: number = 1;
    private _fdCounter: number = 0;
    private _wdCounter: number = 0;

    private constructor(readonly kernel: Kernel) {}

    static async create(kernel: Kernel, version: number = 1) {
        const vfs = new VFS(kernel);
        vfs._driver = await IDBDriver.create("yos-vfs", version, ["inodes", "blocks", "metadata"]);

        let rootNode: INode = await vfs._driver.read("inodes", 0);
        if(!rootNode) {
            rootNode = {
                id: 0,

                type: FileType.DIRECTORY,
                size: 0,
                
                created_at: Date.now(),
                modified_at: Date.now()
            };

            await vfs._driver.write("inodes", 0, rootNode);
        }

        let rootBlock = await vfs._driver.read("blocks", 0);
        if(!rootBlock) {
            rootBlock = new Uint8Array(new TextEncoder().encode("{}"));
            await vfs._driver.write("blocks", 0, rootBlock);
        }

        let nextInodeNum = await vfs._driver.read("metadata", "nextInodeNum");
        if(nextInodeNum === undefined) {
            nextInodeNum = 1;
            await vfs._driver.write("metadata", "nextInodeNum", nextInodeNum);
        }

        vfs._inodeCache.set(0, rootNode);
        vfs._blockCache.set(0, rootBlock);

        vfs._nextInodeNum = nextInodeNum;

        return vfs;
    }

    async mkdir(path: string, options?: { recursive?: boolean }) {
        const { parent, name } = await this._resolvePath(path, !!options?.recursive);
        const newDir = await this._createFile(parent, name, FileType.DIRECTORY);

        this._fsnotify(parent, FsNotifyEventType.CREATE | FsNotifyEventType.ISDIR, name);

        return newDir;
    }

    async rmdir(path: string) {
        const { parent, name } = await this._resolvePath(path);
        if(parent.type !== FileType.DIRECTORY) {
            throw new Error("Parent node is not a directory");
        }

        const parentBlock = await this._readBlock(parent.id);
        const parentDir = this._decodeDirBlock(parentBlock);
        const inodeNum = parentDir[name];
        if(inodeNum === undefined) {
            throw new Error("File or directory does not exist");
        }

        const inode = await this._readINode(inodeNum);
        if(inode.type === FileType.DIRECTORY) {
            const dirBlock = await this._readBlock(inode.id);
            const dir = this._decodeDirBlock(dirBlock);
            if(Object.keys(dir).length > 0) {
                throw new Error("Directory is not empty");
            }
        } else {
            throw new Error("Specified path is not a directory");
        }

        delete parentDir[name];

        const newParentBlock = this._encodeDirBlock(parentDir);
        if(this._blockCache.has(parent.id)) {
            this._blockCache.set(parent.id, newParentBlock);
        }

        parent.modified_at = Date.now();
        parent.size = newParentBlock.length;

        await Promise.all([
            this._driver.write("blocks", parent.id, newParentBlock),
            this._driver.write("inodes", parent.id, parent),

            this._driver.delete("inodes", inodeNum),
            this._driver.delete("blocks", inodeNum),
        ]);

        this._inodeCache.delete(inodeNum);
        this._blockCache.delete(inodeNum);

        this._fsnotify(parent, FsNotifyEventType.DELETE | FsNotifyEventType.ISDIR, name);
        this._fsnotify(inode, FsNotifyEventType.DELETE_SELF, "");
    }

    async unlink(path: string) {
        const { parent, name } = await this._resolvePath(path);
        const parentBlock = await this._readBlock(parent.id);
        const parentDir = this._decodeDirBlock(parentBlock);
        const inodeNum = parentDir[name];
        if(inodeNum === undefined) {
            throw new Error("File does not exist");
        }

        const inode = await this._readINode(inodeNum);
        if(inode.type === FileType.DIRECTORY) {
            throw new Error("Specified path is a directory");
        }

        delete parentDir[name];

        const newParentBlock = this._encodeDirBlock(parentDir);
        if(this._blockCache.has(parent.id)) {
            this._blockCache.set(parent.id, newParentBlock);
        }

        parent.modified_at = Date.now();
        parent.size = newParentBlock.length;

        await Promise.all([
            this._driver.write("blocks", parent.id, newParentBlock),
            this._driver.write("inodes", parent.id, parent),

            this._driver.delete("inodes", inodeNum),
            this._driver.delete("blocks", inodeNum),
        ]);

        this._inodeCache.delete(inodeNum);
        this._blockCache.delete(inodeNum);

        this._fsnotify(parent, FsNotifyEventType.DELETE, name);
    }

    async opendir(path: string) {
        let inodeNum: number;

        if(path === "/") {
            inodeNum = 0;
        } else {
            const { parent, name } = await this._resolvePath(path);
            const parentDir = this._decodeDirBlock(await this._readBlock(parent.id));

            inodeNum = parentDir[name];
            if(inodeNum === undefined) {
                throw new Error(`Directory ${name} does not exist`);
            }
        }

        const inode = await this._readINode(inodeNum);
        if(inode.type !== FileType.DIRECTORY) {
            throw new Error("Specified path is not a directory");
        }

        const dirBlock = await this._readBlock(inode.id);
        const dir = this._decodeDirBlock(dirBlock);

        const entries: DirEntry[] = [];
        for(const [entryName, entryInodeNum] of Object.entries(dir)) {
            const entryInode = await this._readINode(entryInodeNum);
            entries.push({
                inode: entryInodeNum,
                type: entryInode.type,
                name: entryName
            });
        }

        return {
            id: this._fdCounter++,
            inode: inode.id,
            entries,
            position: 0
        } as DirDescriptor;
    }

    readdir(dir: DirDescriptor) {
        if(dir.position >= dir.entries.length) {
            return null;
        }

        const entry = dir.entries[dir.position];
        dir.position++;

        return entry;
    }

    inotify_create() {
        return {
            id: this._fdCounter++,
            fsnotify_group: { watchers: [], events: [], notification_waitq: [] },
            type: "inotify"
        } as any as FileDescriptor;
    }

    async inotify_add_watch(fd: FileDescriptor, path: string, mask: number) {
        if(fd.type !== "inotify") {
            throw new Error("File descriptor is not an inotify instance");
        }

        if(fd.fsnotify_group.closed) {
            throw new Error("Inotify instance is closed");
        }

        let inodeNum;
        if(path === "/") {
            inodeNum = 0;
        } else {
            const { parent, name } = await this._resolvePath(path);
            const parentDir = this._decodeDirBlock(await this._readBlock(parent.id));
            inodeNum = parentDir[name];
        }

        if(inodeNum === undefined) {
            throw new Error("File or directory does not exist");
        }

        const inode = await this._readINode(inodeNum);
        const watcher: FsNotifyWatcher = {
            id: this._wdCounter++,
            group: fd.fsnotify_group,
            mask,
            inode
        };

        fd.fsnotify_group.watchers.push(watcher);

        if(!this._inodeWatchers.has(inode.id)) {
            this._inodeWatchers.set(inode.id, new Set());
        }

        this._inodeWatchers.get(inode.id)!.add(watcher);

        return watcher.id;
    }

    inotify_rm_watch(fd: FileDescriptor, watchId: number) {
        if(fd.type !== "inotify") {
            throw new Error("File descriptor is not an inotify instance");
        }

        if(fd.fsnotify_group.closed) {
            throw new Error("Inotify instance is closed");
        }

        const watcherIndex = fd.fsnotify_group.watchers.findIndex(w => w.id === watchId);
        if(watcherIndex === -1) {
            throw new Error("Watch ID does not exist in this inotify instance");
        }

        const [watcher] = fd.fsnotify_group.watchers.splice(watcherIndex, 1);

        const inodeWatchers = this._inodeWatchers.get(watcher.inode.id);
        if(inodeWatchers) {
            inodeWatchers.delete(watcher);
            if(inodeWatchers.size === 0) {
                this._inodeWatchers.delete(watcher.inode.id);
            }
        }
    }

    async open(path: string) {
        console.log(`Opening file at path: ${path}`);

        const { parent, name } = await this._resolvePath(path);
        const parentDir = this._decodeDirBlock(await this._readBlock(parent.id));
        let node: INode;

        if(parentDir[name] === undefined) {
            node = await this._createFile(parent, name, FileType.FILE);
            this._fsnotify(parent, FsNotifyEventType.CREATE, name);
        } else {
            node = await this._readINode(parentDir[name]);
            if(node.type !== FileType.FILE) {
                throw new Error(`${name} is not a file`);
            }
        }

        return {
            id: this._fdCounter++,
            inode: node.id,
            position: 0,
            type: "file"
        } as FileDescriptor;
    }

    async write(fd: FileDescriptor, data: Uint8Array) {
        const inode = await this._readINode(fd.inode);
        if(inode.type !== FileType.FILE) {
            throw new Error("Cannot write to a directory");
        }

        let block = await this._readBlock(inode.id);

        const isOverflow = fd.position + data.length > block.length;
        if(isOverflow) {
            const newBlock = new Uint8Array(fd.position + data.length);
            newBlock.set(block.slice(0, fd.position), 0);
            newBlock.set(data, fd.position);

            block = newBlock;
            if(this._blockCache.has(inode.id)) {
                this._blockCache.set(inode.id, block);
            }
        } else {
            block.set(data, fd.position);
        }

        inode.size = Math.max(inode.size, fd.position + data.length);
        inode.modified_at = Date.now();

        await Promise.all([
            this._driver.write("blocks", inode.id, block),
            this._driver.write("inodes", inode.id, inode)
        ]);

        fd.position += data.length;

        this._fsnotify(inode, FsNotifyEventType.MODIFY, "");

        return data.length;
    }

    async read(fd: FileDescriptor, length: number): Promise<Uint8Array> {
        if(fd.type === "inotify") {
            const group = fd.fsnotify_group;

            if(group.closed) {
                throw new Error("Inotify instance is closed");
            }

            while(group.events.length === 0) {
                await new Promise<void>(resolve => group.notification_waitq.push(resolve));
            }

            if(group.closed) {
                throw new Error("Inotify instance is closed");
            }

            const events = group.events.splice(0);
            return new TextEncoder().encode(JSON.stringify(events));
        } else {
            const inode = await this._readINode(fd.inode);
            if(inode.type !== FileType.FILE) {
                throw new Error("Cannot read from a directory");
            }

            const block = await this._readBlock(inode.id);
            const data = block.slice(fd.position, fd.position + length);
            fd.position += data.length;

            return data;
        }
    }

    async close(fd: FileDescriptor) {
        if(fd.type === "inotify") {
            for(const watcher of fd.fsnotify_group.watchers) {
                const inodeWatchers = this._inodeWatchers.get(watcher.inode.id);
                if(inodeWatchers) {
                    inodeWatchers.delete(watcher);
                    if(inodeWatchers.size === 0) {
                        this._inodeWatchers.delete(watcher.inode.id);
                    }
                }
            }

            fd.fsnotify_group.closed = true;

            const notificationWaiters = fd.fsnotify_group.notification_waitq.splice(0);
            notificationWaiters.forEach(waiter => waiter());
        }
    }

    async lseek(fd: FileDescriptor, position: number) {
        const inode = await this._readINode(fd.inode);
        if(!inode || inode.type !== FileType.FILE) {
            throw new Error("Invalid file descriptor");
        }

        if(position < 0 || position > inode.size) {
            throw new Error("Invalid position");
        }

        fd.position = position;
    }

    async fseek(fd: FileDescriptor, offset: number, whence: "SET" | "CUR" | "END") {
        const inode = await this._readINode(fd.inode);
        if(!inode || inode.type !== FileType.FILE) {
            throw new Error("Invalid file descriptor");
        }

        let newPosition: number;
        switch(whence) {
            case "SET":
                newPosition = offset;
                break;
            case "CUR":
                newPosition = fd.position + offset;
                break;
            case "END":
                newPosition = inode.size + offset;
                break;
            default:
                throw new Error("Invalid whence");
        }

        if(newPosition < 0 || newPosition > inode.size) {
            throw new Error("Invalid position");
        }

        fd.position = newPosition;
    }

    async stat(path: string) {
        if(path === "/") {
            return await this._readINode(0);
        }
        
        const { parent, name } = await this._resolvePath(path);
        const parentDir = this._decodeDirBlock(await this._readBlock(parent.id));
        const inodeNum = parentDir[name];
        if(inodeNum === undefined) {
            throw new Error("File or directory does not exist");
        }

        const inode = await this._readINode(inodeNum);
        return inode;
    }

    async printStructure() {
        // print VFS structure for debugging
        const printDir = async (path: string, indent: string = "") => {
            const dir = await this.opendir(path);
            let entry;
            while(entry = this.readdir(dir)) {
            const node = await this.stat(path + "/" + entry.name);
            console.log(`${indent}${entry.name} (${node.type === FileType.DIRECTORY ? "DIR" : "FILE"}) size=${(node.size / 1024).toFixed(2)}KB`);
            if(node.type === FileType.DIRECTORY) {
                await printDir(path + "/" + entry.name, indent + "  ");
            }
            }
        };

        console.log("VFS Structure:");
        await printDir("/");
    }

    private _fsnotify(inode: INode, eventType: FsNotifyEventType, name: string) {
        const watchers = this._inodeWatchers.get(inode.id);
        if(!watchers) {
            return;
        }

        for(const watcher of watchers) {
            if((watcher.mask & eventType) === 0) {
                continue;
            }

            const event: FsNotifyEvent = {
                watcher: watcher.id,
                type: eventType,
                name
            };

            watcher.group.events.push(event);

            const notificationWaiter = watcher.group.notification_waitq.shift();
            notificationWaiter?.();
        }

        if((eventType & FsNotifyEventType.DELETE_SELF) !== 0) {
            for(const watcher of watchers) {
                const index = watcher.group.watchers.findIndex(w => w.id === watcher.id);
                if(index !== -1) {
                    watcher.group.watchers.splice(index, 1);
                }
            }

            this._inodeWatchers.delete(inode.id);
        }
    }

    private async _resolvePath(path: string, recursive?: boolean): Promise<{ parent: INode, name: string }> {
        const parts = path.split("/").filter(part => part.length > 0);
        const filename = parts.pop();

        if(!filename) {
            throw new Error("Invalid path");
        }

        let currentNode: INode = await this._readINode(0);
        for(const part of parts) {
            const currentDir = this._decodeDirBlock(await this._readBlock(currentNode.id));
            const inodeNum = currentDir[part];
            if(inodeNum === undefined) {
                if(!recursive) {
                    throw new Error(`Directory ${part} does not exist. Fullpath: ${path}`);
                }

                const newDir = await this._createFile(currentNode, part, FileType.DIRECTORY);
                currentNode = newDir;

                this._fsnotify(currentNode, FsNotifyEventType.CREATE | FsNotifyEventType.ISDIR, part);
                
                continue;
            }

            const inode = await this._readINode(inodeNum);
            if(inode.type !== FileType.DIRECTORY) {
                throw new Error(`${part} is not a directory`);
            }

            currentNode = inode;
        }

        return { parent: currentNode, name: filename };
    }

    private async _createFile(parent: INode, name: string, type: FileType): Promise<INode> {
        if(parent.type !== FileType.DIRECTORY) {
            throw new Error("Parent node is not a directory");
        }

        let parentBlock = await this._readBlock(parent.id);
        const parentDir = this._decodeDirBlock(parentBlock);
        if(parentDir[name] !== undefined) {
            throw new Error(`File or directory ${name} already exists`);
        }

        const iNodeId = this._nextInodeNum++;
        const newInode: INode = {
            id: iNodeId,

            type: type,
            size: 0,

            created_at: Date.now(),
            modified_at: Date.now()
        };

        parentDir[name] = iNodeId;
        parentBlock = this._encodeDirBlock(parentDir);

        if(this._blockCache.has(parent.id)) {
            this._blockCache.set(parent.id, parentBlock);
        }

        parent.modified_at = Date.now();
        parent.size = parentBlock.length;

        await Promise.all([
            this._driver.write("inodes", iNodeId, newInode),
            type === FileType.DIRECTORY 
                ? this._driver.write("blocks", iNodeId, this._encodeDirBlock({})) 
                : this._driver.write("blocks", iNodeId, new Uint8Array()),

            this._driver.write("inodes", parent.id, parent),
            this._driver.write("blocks", parent.id, parentBlock),

            this._driver.write("metadata", "nextInodeNum", this._nextInodeNum),
        ]);

        return newInode;
    }

    private async _readINode(inodeNum: number, cache = true): Promise<INode> {
        if(this._inodeCache.has(inodeNum)) {
            return this._inodeCache.get(inodeNum)!;
        }

        const inode = await this._driver.read("inodes", inodeNum);
        if(!inode) {
            throw new Error(`INode ${inodeNum} does not exist`);
        }

        if(cache) {
            this._inodeCache.set(inodeNum, inode);
        }

        return inode;
    }

    private async _readBlock(inodeNum: number, cache = true): Promise<Block> {
        if(this._blockCache.has(inodeNum)) {
            return this._blockCache.get(inodeNum)!;
        }

        const block = await this._driver.read("blocks", inodeNum);
        if(!block) {
            throw new Error(`Block ${inodeNum} does not exist`);
        }

        if(cache) {
            this._blockCache.set(inodeNum, block);
        }

        return block as Block;
    }

    private _decodeDirBlock(block: Block): DirBlock {
        return JSON.parse(new TextDecoder().decode(block)) as DirBlock;
    }

    private _encodeDirBlock(dir: DirBlock): Block {
        return new TextEncoder().encode(JSON.stringify(dir));
    }
}

export { VFS, FileType };