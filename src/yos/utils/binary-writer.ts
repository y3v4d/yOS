export class BinaryWriter {
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