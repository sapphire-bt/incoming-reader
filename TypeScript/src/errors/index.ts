export class InvalidVersionError extends Error {
    constructor(message: string = 'Invalid file version') {
        super(message);
        this.name = 'InvalidVersionError';
        Object.setPrototypeOf(this, InvalidVersionError.prototype);
    }
}


export class InvalidMeshHeaderError extends Error {
    constructor(message: string = 'Mesh header mismatch') {
        super(message);
        this.name = 'InvalidMeshHeaderError';
        Object.setPrototypeOf(this, InvalidMeshHeaderError.prototype);
    }
}
