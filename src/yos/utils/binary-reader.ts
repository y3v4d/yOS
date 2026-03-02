export class BinaryReader {
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