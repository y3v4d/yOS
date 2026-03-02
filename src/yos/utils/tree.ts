export class TreeNode<T> {
    public value: T;
    
    private _firstChild: TreeNode<T> | null = null;
    private _lastChild: TreeNode<T> | null = null;

    private _nextSibling: TreeNode<T> | null = null;
    private _prevSibling: TreeNode<T> | null = null;

    private _parent: TreeNode<T> | null = null;

    constructor(value: T) {
        this.value = value;
    }

    addChild(child: TreeNode<T>): void {
        child._parent = this;

        if(!this._firstChild) {
            child._prevSibling = null;
            child._nextSibling = null;

            this._firstChild = child;
            this._lastChild = child;
        } else {
            child._prevSibling = this._lastChild;
            child._nextSibling = null;

            if(this._lastChild) {
                this._lastChild._nextSibling = child;
            }
            this._lastChild = child;
        }
    }

    removeChild(child: TreeNode<T>): void {
        if(child._parent !== this) {
            throw new Error("The specified node is not a child of this node.");
        }

        if(child._nextSibling) {
            child._nextSibling._prevSibling = child._prevSibling;
        } else {
            this._lastChild = child._prevSibling;
        }

        if(child._prevSibling) {
            child._prevSibling._nextSibling = child._nextSibling;
        } else {
            this._firstChild = child._nextSibling;
        }

        child._parent = null;
        child._prevSibling = null;
        child._nextSibling = null;
    }

    // get children as an iterator
    *iter_children(): IterableIterator<TreeNode<T>> {
        let current = this._firstChild;
        while(current) {
            yield current;
            current = current._nextSibling;
        }
    }

    get parent() {
        return this._parent;
    }
}