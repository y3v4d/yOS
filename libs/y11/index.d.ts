// this is a .d.ts file, declare a global kernel variable
export {};

declare global {
    var kernel: import("../../src/yos/core/kernel").Kernel;

    type Socket = import("../../src/yos/core/kernel").Socket;
}