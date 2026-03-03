import type { VFS } from "../core/vfs";
import { BinaryReader } from "./binary-reader";
import { BinaryWriter } from "./binary-writer";
import PathUtils from "./path-utils";

export enum PropType {
    NUMBER32 = 1,
    STRING = 2,
    BOOLEAN = 3
}

export interface ExecutableProps {
    [key: string]: number | string | boolean;
}

class VfsFormtUtils {
    constructor(
        readonly vfs: VFS
    ) {}

    createShortcut(path: string, targetPath: string, icon?: string, props: ExecutableProps = {}) {
        const writer = new BinaryWriter(1024);
        writer.uint32(targetPath.length);
        writer.string(targetPath);

        if(icon) {
            writer.uint32(icon.length);
            writer.string(icon);
        } else {
            writer.uint32(0);
        }

        this._writeProps(writer, props);

        const fd = this.vfs.open(path + ".lnk");
        this.vfs.write(fd, writer.getBuffer());

        return fd;
    }

    readShortcut(path: string) {
        const { ext } = PathUtils.disect(path);
        if(ext !== "lnk") {
            throw new Error("Invalid shortcut file: " + path);
        }

        const fd = this.vfs.open(path);
        
        this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        this.vfs.fseek(fd, 0, "SET");

        const buffer = this.vfs.read(fd, fileSize);
        const reader = new BinaryReader(buffer);

        const targetPathLength = reader.uint32();
        const targetPath = reader.string(targetPathLength);

        const iconLength = reader.uint32();
        const icon = iconLength > 0 ? reader.string(iconLength) : null;

        const props = this._readProps(reader);

        return { targetPath, icon, props };
    }

    createExecutable(path: string, executable: string, icon?: string, props: ExecutableProps = {}) {
        console.log("Creating executable:", path, executable, icon, props);
        const writer = new BinaryWriter(1024 * 4);
        writer.uint32(executable.length);
        writer.string(executable);

        if(icon) {
            writer.uint32(icon.length);
            writer.string(icon);
        } else {
            writer.uint32(0);
        }

        const propEntries = Object.entries(props);
        writer.uint32(propEntries.length);
        for(const [key, value] of propEntries) {
            writer.uint32(key.length);
            writer.string(key);

            if(typeof value === "number") {
                writer.uint8(PropType.NUMBER32);
                writer.int32(value);
            } else if(typeof value === "string") {
                writer.uint8(PropType.STRING);
                writer.uint32(value.length);
                writer.string(value);
            } else if(typeof value === "boolean") {
                writer.uint8(PropType.BOOLEAN);
                writer.uint8(value ? 1 : 0);
            }
        }

        const fd = this.vfs.open(path + ".exe");
        this.vfs.write(fd, writer.getBuffer());

        return fd;
    }

    readExecutable(path: string) {
        const { base, name, ext } = PathUtils.disect(path);
        if(ext !== "exe") {
            throw new Error("Invalid executable file: " + path);
        }
        
        const fd = this.vfs.open(path);
        
        this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        this.vfs.fseek(fd, 0, "SET");

        const buffer = this.vfs.read(fd, fileSize);
        const reader = new BinaryReader(buffer);

        const executableLength = reader.uint32();
        const executable = reader.string(executableLength);

        const iconLength = reader.uint32();
        const icon = iconLength > 0 ? reader.string(iconLength) : null;

        const propsCount = reader.uint32();
        const props: ExecutableProps = {};
        for(let i = 0; i < propsCount; i++) {
            const keyLength = reader.uint32();
            const key = reader.string(keyLength);

            const type = reader.uint8();
            let value: number | string | boolean;

            if(type === PropType.NUMBER32) {
                value = reader.int32();
            } else if(type === PropType.STRING) {
                const strLength = reader.uint32();
                value = reader.string(strLength);
            } else if(type === PropType.BOOLEAN) {
                value = reader.uint8() === 1;
            } else {
                throw new Error("Invalid property type in executable: " + type);
            }

            props[key] = value;
        }

        return { executable, icon, props };
    }

    private _writeProps(writer: BinaryWriter, props: ExecutableProps) {
        const propEntries = Object.entries(props);
        writer.uint32(propEntries.length);
        for(const [key, value] of propEntries) {
            writer.uint32(key.length);
            writer.string(key);

            if(typeof value === "number") {
                writer.uint8(PropType.NUMBER32);
                writer.int32(value);
            } else if(typeof value === "string") {
                writer.uint8(PropType.STRING);
                writer.uint32(value.length);
                writer.string(value);
            } else if(typeof value === "boolean") {
                writer.uint8(PropType.BOOLEAN);
                writer.uint8(value ? 1 : 0);
            }
        }
    }

    private _readProps(reader: BinaryReader): ExecutableProps {
        const propsCount = reader.uint32();
        const props: ExecutableProps = {};
        for(let i = 0; i < propsCount; i++) {
            const keyLength = reader.uint32();
            const key = reader.string(keyLength);

            const type = reader.uint8();
            let value: number | string | boolean;

            if(type === PropType.NUMBER32) {
                value = reader.int32();
            } else if(type === PropType.STRING) {
                const strLength = reader.uint32();
                value = reader.string(strLength);
            } else if(type === PropType.BOOLEAN) {
                value = reader.uint8() === 1;
            } else {
                throw new Error("Invalid property type in executable: " + type);
            }

            props[key] = value;
        }

        return props;
    }
}

export { VfsFormtUtils };