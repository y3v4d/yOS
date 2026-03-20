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

class VFS {
    private _driver: IDBDriver = null!;

    private _inodeCache: Map<number, INode> = new Map();
    private _blockCache: Map<number, Block> = new Map();

    private _nextInodeNum: number = 1;
    private _fdCounter: number = 0;

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

    async open(path: string) {
        console.log(`Opening file at path: ${path}`);

        const { parent, name } = await this._resolvePath(path);
        const parentDir = this._decodeDirBlock(await this._readBlock(parent.id));
        let node: INode;

        if(parentDir[name] === undefined) {
            node = await this._createFile(parent, name, FileType.FILE);
        } else {
            node = await this._readINode(parentDir[name]);
            if(node.type !== FileType.FILE) {
                throw new Error(`${name} is not a file`);
            }
        }

        return {
            id: this._fdCounter++,
            inode: node.id,
            position: 0
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

        return data.length;
    }

    async read(fd: FileDescriptor, length: number): Promise<Uint8Array> {
        const inode = await this._readINode(fd.inode);
        if(inode.type !== FileType.FILE) {
            throw new Error("Cannot read from a directory");
        }

        const block = await this._readBlock(inode.id);
        const data = block.slice(fd.position, fd.position + length);
        fd.position += data.length;

        return data;
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