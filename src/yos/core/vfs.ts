import { BinaryReader } from "../utils/binary-reader";
import { TreeNode } from "../utils/tree";
import type { Kernel } from "./kernel";

enum FileType {
    FILE = 0,
    DIRECTORY = 1
}

interface INode {
    id: number;

    type: FileType;
    size: number;

    created_time: number;
    modified_time: number;
}

export interface DirEntry {
    inode: number;
    type: FileType;

    name: string;
}

export interface FileDescriptor {
    fd: number;
    inode: number;

    position: number;
}

interface DirDescriptor {
    fd: number;
    inode: number;
    tnode: TreeNode<DirEntry>;

    position: number;
}

class DirectoryStructure {
    private _root: TreeNode<DirEntry>;

    constructor(rootInode: INode) {
        this._root = new TreeNode<DirEntry>({
            inode: rootInode.id,
            type: rootInode.type,

            name: "/"
        });
    }

    get root() {
        return this._root;
    }
}

class VFS {
    private _structure: DirectoryStructure;

    private _inodes: Map<number, INode> = new Map();
    private _dataBlocks: Map<number, Uint8Array> = new Map();

    private _nextInodeId: number = 0;
    private _nextFd: number = 0;

    constructor(
        readonly kernel: Kernel
    ) {
        const rootInode: INode = {
            id: this._nextInodeId++,
            type: FileType.DIRECTORY,

            size: 0,

            created_time: Date.now(),
            modified_time: Date.now()
        };

        this._inodes.set(rootInode.id, rootInode);
        this._structure = new DirectoryStructure(rootInode);
    }

    stat(path: string): INode { // gets inode info
        const { parent, name } = this._getParentAndName(path);
        if(parent.value.type !== FileType.DIRECTORY) {
            throw new Error("Parent is not a directory");
        }

        for(const child of parent.iter_children()) {
            if(child.value.name === name) {
                const inode = this._inodes.get(child.value.inode);
                if(!inode) {
                    throw new Error("Inode not found");
                }

                return inode;
            }
        }

        throw new Error(`File or directory does not exist: ${path}`);
    }

    open(path: string) { // opens files
        const { parent, name } = this._getParentAndName(path);
        if(parent.value.type !== FileType.DIRECTORY) {
            throw new Error("Parent is not a directory");
        }

        let node: TreeNode<DirEntry> | null = null;
        for(const child of parent.iter_children()) {
            if(child.value.name === name) {
                const inode = this._inodes.get(child.value.inode);
                if(!inode || inode.type !== FileType.FILE) {
                    throw new Error("Path is not a file");
                }

                node = child;
                break;
            }
        }

        if(!node) {
            node = this.__createfile(parent, name, FileType.FILE);
            this.kernel.emit({ type: "file:created", path });
        }

        return {
            fd: this._nextFd++,
            inode: node.value.inode,

            position: 0
        } satisfies FileDescriptor;
    }

    write(fd: FileDescriptor, data: Uint8Array) { // writes to files, always replace existing data
        const inode = this._inodes.get(fd.inode);
        if(!inode || inode.type !== FileType.FILE) {
            throw new Error("Invalid file inode");
        }

        this._dataBlocks.set(inode.id, data);

        inode.size = data.length;
        inode.modified_time = Date.now();

        fd.position = data.length;
        return data.length;        
    }

    read(fd: FileDescriptor, length: number): Uint8Array { // reads from files
        const inode = this._inodes.get(fd.inode);
        if(!inode || inode.type !== FileType.FILE) {
            throw new Error("Invalid file inode");
        }

        const data = this._dataBlocks.get(inode.id) || new Uint8Array(0);
        const readData = data.slice(fd.position, fd.position + length);

        fd.position += readData.length;
        return readData;
    }

    lseek(fd: FileDescriptor, position: number) { // seeks to position in file
        const inode = this._inodes.get(fd.inode);
        if(!inode || inode.type !== FileType.FILE) {
            throw new Error("Invalid file inode");
        }

        if(position < 0 || position > inode.size) {
            throw new Error("Invalid seek position");
        }

        fd.position = position;
    }

    fseek(fd: FileDescriptor, offset: number, whence: "SET" | "CUR" | "END") {
        const inode = this._inodes.get(fd.inode);
        if(!inode || inode.type !== FileType.FILE) {
            throw new Error("Invalid file inode");
        }

        let newPosition = fd.position;
        if(whence === "SET") {
            newPosition = offset;
        } else if(whence === "CUR") {
            newPosition += offset;
        } else if(whence === "END") {
            newPosition = inode.size + offset;
        }

        if(newPosition < 0 || newPosition > inode.size) {
            throw new Error("Invalid seek position");
        }

        fd.position = newPosition;
    }
    

    mkdir(path: string, recursive: boolean = true) { // creates directories
        const parts = path.split("/").filter(p => p.length > 0);
        const filename = parts.pop() || "";

        let currentNode = this._structure.root;
        for(const part of parts) {
            let found = false;

            for(const child of currentNode.iter_children()) {
                if(child.value.name !== part) {
                    continue;
                }

                const inode = this._inodes.get(child.value.inode);
                if(!inode || inode.type !== FileType.DIRECTORY) {
                    throw new Error(`Path component '${part}' is not a directory`);
                }

                currentNode = child;
                found = true;

                break;
            }

            if(!found) {
                if(!recursive) {
                    throw new Error(`Directory '${part}' does not exist`);
                }

                currentNode = this.__createfile(currentNode, part, FileType.DIRECTORY);
            }
        }

        this.__createfile(currentNode, filename, FileType.DIRECTORY);
    }

    opendir(path: string): DirDescriptor { // opens directories
        const { parent, name } = this._getParentAndName(path);
        if(parent.value.type !== FileType.DIRECTORY) {
            throw new Error("Parent is not a directory");
        }

        let node: TreeNode<DirEntry> | null = null;
        for(const child of parent.iter_children()) {
            if(child.value.name === name) {
                const inode = this._inodes.get(child.value.inode);
                if(!inode || inode.type !== FileType.DIRECTORY) {
                    throw new Error("Path is not a directory");
                }

                node = child;
                break;
            }
        }

        if(!node) {
            throw new Error("Directory does not exist");
        }

        const dirDescriptor: DirDescriptor = {
            fd: this._nextFd++,
            inode: node.value.inode,
            tnode: node,

            position: 0
        };

        return dirDescriptor;
    }

    readdir(dir: DirDescriptor): DirEntry | null {
        const dirInode = this._inodes.get(dir.inode);
        if(!dirInode || dirInode.type !== FileType.DIRECTORY) {
            throw new Error("Invalid directory inode");
        }

        const dirNode = dir.tnode;
        const children = Array.from(dirNode.iter_children());

        const child = children[dir.position];
        if(!child) {
            return null;
        }

        dir.position++;
        return child.value;
    }

    printStructure(): void {
        const printNode = (node: TreeNode<DirEntry>, indent: string) => {
            console.log(`${indent}- ${node.value.name} (inode: ${node.value.inode}, type: ${FileType[node.value.type]}, size: ${this._inodes.get(node.value.inode)?.size || 0})`);
            for(const child of node.iter_children()) {
                printNode(child, indent + "  ");
            }
        };

        printNode(this._structure.root, "");
    }

    printBlocks(): void {
        for(const [id, data] of this._dataBlocks) {
            const binaryReader = new BinaryReader(data);
            const length = binaryReader.uint32();
            const text = binaryReader.string(length);

            console.log(`Block iNode #${id} - ${text}`);
        }
    }

    private __createfile(parent: TreeNode<DirEntry>, name: string, type: FileType): TreeNode<DirEntry> {
        const newInode: INode = {
            id: this._nextInodeId++,
            type: type,

            size: 0,

            created_time: Date.now(),
            modified_time: Date.now()
        };

        this._inodes.set(newInode.id, newInode);
        const newNode = new TreeNode<DirEntry>({
            inode: newInode.id,
            type: newInode.type,

            name: name
        });
        parent.addChild(newNode);

        return newNode;
    }

    private _getParentAndName(path: string): { parent: TreeNode<DirEntry>; name: string; } {
        const parts = path.split("/").filter(p => p.length > 0);
        const name = parts.pop() || "";
        let currentNode = this._structure.root;

        for(const part of parts) {
            let found = false;

            for(const child of currentNode.iter_children()) {
                if(child.value.name !== part) {
                    continue;
                }
                
                const inode = this._inodes.get(child.value.inode);
                if(!inode || inode.type !== FileType.DIRECTORY) {
                    throw new Error(`Path component '${part}' is not a directory`);
                }

                currentNode = child;
                found = true;

                break;
            }

            if(!found) {
                throw new Error(`Directory '${part}' does not exist`);
            }
        }

        return { parent: currentNode, name };
    }
}

export { VFS };