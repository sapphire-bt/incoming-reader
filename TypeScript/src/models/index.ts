export interface Face {
    unknown1: number;
    unknown2: number;
    indices: [number, number, number];
}


export interface Vertex {
    x: number;
    y: number;
    z: number;
}


export interface VertexInfo extends Vertex {
    normals: [number, number, number];
    u: number;
    v: number;
}


export interface MeshData {
    faces: Face[];
    vertices: Vertex[];
}


export class MeshHeader {
    constructor(
        public faceCount: number,
        public vertexCount: number,
        public verticesOffset: number,
        public facesOffset: number,
        public unknown: number
    ) {}

    isEqualTo(other: MeshHeader): boolean {
        return (
            this.faceCount === other.faceCount &&
            this.vertexCount === other.vertexCount &&
            this.verticesOffset === other.verticesOffset &&
            this.facesOffset === other.facesOffset &&
            this.unknown === other.unknown
        );
    }
}
