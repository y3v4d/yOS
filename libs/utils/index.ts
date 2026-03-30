export enum PropType {
    NUMBER32 = 1,
    STRING = 2,
    BOOLEAN = 3
}

interface ExecutableProps {
    [key: string]: number | string | boolean;
}

export class vfsFormat {
    constructor(
        readonly vfs: any
    ) {}

    async createShortcut(path: string, targetPath: string, icon?: string, props: ExecutableProps = {}) {
        const writer = new binaryWriter(2048);
        writer.uint32(targetPath.length);
        writer.string(targetPath);

        if(icon) {
            writer.uint32(icon.length);
            writer.string(icon);
        } else {
            writer.uint32(0);
        }

        this._writeProps(writer, props);

        const fd = await this.vfs.open(path + ".lnk");
        await this.vfs.write(fd, writer.getBuffer());

        return fd;
    }

    async readShortcut(path: string) {
        const { ext } = pathUtils.disect(path);
        if(ext !== "lnk") {
            throw new Error("Invalid shortcut file: " + path);
        }

        const fd = await this.vfs.open(path);
        
        await this.vfs.fseek(fd, 0, "END");
        const fileSize = fd.position;
        await this.vfs.fseek(fd, 0, "SET");

        const buffer = await this.vfs.read(fd, fileSize);
        const reader = new binaryReader(buffer);

        const targetPathLength = reader.uint32();
        const targetPath = reader.string(targetPathLength);

        const iconLength = reader.uint32();
        const icon = iconLength > 0 ? reader.string(iconLength) : null;

        const props = this._readProps(reader);

        return { targetPath, icon, props };
    }

    private _writeProps(writer: binaryWriter, props: ExecutableProps) {
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

    private _readProps(reader: binaryReader): ExecutableProps {
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

namespace pathUtils {
    export function dirname(path: string): string {
        const parts = path.split("/").filter(part => part.length > 0);
        parts.pop();

        return "/" + parts.join("/");
    }

    export function basename(path: string): string {
        const parts = path.split("/").filter(part => part.length > 0);
        return parts.pop() || "";
    }

    export function disect(path: string): { dir: string, base: string, name: string, ext: string } {
        const dir = dirname(path);
        const base = basename(path);

        const nameParts = base.split(".");
        const name = nameParts.slice(0, -1).join(".");
        const ext = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

        return { dir, base, name, ext };
    }

    export function join(...parts: string[]): string {
        const joined = parts.join("/").replace(/\/+/g, "/");
        return normalize(joined);
    }

    export function normalize(path: string): string {
        const parts = path.split("/").filter(part => part.length > 0);
        const stack: string[] = [];

        for(const part of parts) {
            if(part === ".") {
                continue;
            } else if(part === "..") {
                stack.pop();
            } else {
                stack.push(part);
            }
        }

        return "/" + stack.join("/");
    }

    export function isAbsolute(path: string): boolean {
        return path.startsWith("/");
    }

    export function extname(path: string): string {
        const base = basename(path);
        const index = base.lastIndexOf(".");

        if(index === -1) {
            return "";
        }

        return base.substring(index);
    }

    export function relative(from: string, to: string): string {
        const fromParts = normalize(from).split("/").filter(part => part.length > 0);
        const toParts = normalize(to).split("/").filter(part => part.length > 0);

        let i = 0;
        while(i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
            i++;
        }

        const upMoves = fromParts.length - i;
        const downMoves = toParts.slice(i);

        const relParts = [];
        for(let j = 0; j < upMoves; j++) {
            relParts.push("..");
        }
        relParts.push(...downMoves);

        return relParts.join("/") || ".";
    }

    export function isSubpath(parent: string, child: string): boolean {
        const parentParts = normalize(parent).split("/").filter(part => part.length > 0);
        const childParts = normalize(child).split("/").filter(part => part.length > 0);

        if(parentParts.length > childParts.length) {
            return false;
        }

        for(let i = 0; i < parentParts.length; i++) {
            if(parentParts[i] !== childParts[i]) {
                return false;
            }
        }

        return true;
    }
}

export { pathUtils as path };

export class binaryWriter {
    private _buffer: ArrayBuffer;
    private _view: DataView;

    private _offset: number = 0;

    constructor(size: number) {
        this._buffer = new ArrayBuffer(size);
        this._view = new DataView(this._buffer);
    }

    int8(value: number): void {
        this._view.setInt8(this._offset++, value);
    }

    uint8(value: number): void {
        this._view.setUint8(this._offset++, value);
    }

    int16(value: number): void {
        this._view.setInt16(this._offset, value, true);
        this._offset += 2;
    }

    uint16(value: number): void {
        this._view.setUint16(this._offset, value, true);
        this._offset += 2;
    }

    int32(value: number): void {
        this._view.setInt32(this._offset, value, true);
        this._offset += 4;
    }

    uint32(value: number): void {
        this._view.setUint32(this._offset, value, true);
        this._offset += 4;
    }

    boolean(value: boolean): void {
        this.uint8(value ? 1 : 0);
    }

    bytes(data: Uint8Array): void {
        new Uint8Array(this._buffer, this._offset, data.length).set(data);
        this._offset += data.length;
    }

    string(value: string): void {
        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        this.bytes(data);
    }

    getBuffer(): Uint8Array {
        return new Uint8Array(this._buffer, 0, this._offset);
    }
}

export class binaryReader {
    private _view: DataView;

    private _data: Uint8Array;
    private _offset: number = 0;

    constructor(data: Uint8Array) {
        this._data = data;
        this._view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    int8(): number {
        return this._view.getInt8(this._offset++);
    }

    uint8(): number {
        return this._view.getUint8(this._offset++);
    }

    int16(): number {
        const value = this._view.getInt16(this._offset, true);
        this._offset += 2;

        return value;
    }

    uint16(): number {
        const value = this._view.getUint16(this._offset, true);
        this._offset += 2;

        return value;
    }

    int32(): number {
        const value = this._view.getInt32(this._offset, true);
        this._offset += 4;

        return value;
    }

    uint32(): number {
        const value = this._view.getUint32(this._offset, true);
        this._offset += 4;

        return value;
    }

    boolean(): boolean {
        return this.uint8() !== 0;
    }

    bytes(length: number): Uint8Array {
        const value = this._data.subarray(this._offset, this._offset + length);
        this._offset += length;

        return value;
    }

    string(length: number): string {
        const bytes = this.bytes(length);
        return new TextDecoder().decode(bytes);
    }
}