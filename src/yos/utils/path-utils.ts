namespace PathUtils {
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
        return parts.join("/").replace(/\/+/g, "/");
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

export default PathUtils;