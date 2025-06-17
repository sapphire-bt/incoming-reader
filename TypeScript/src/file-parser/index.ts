import { InvalidMeshHeaderError, InvalidVersionError } from '@errors';
import {
    Face,
    MeshData,
    MeshHeader,
    VertexInfo,
} from '@models';


type ReadBytesFunction = (offset: number) => number;


export default class IncomingModelFile {
    private buffer: Buffer;
    private offset: number = 0;
    private hasParsedData: boolean = false;

    public faceCount!: number;
    public vertexCount!: number;
    public verticesOffset!: number;
    public facesOffset!: number;
    public endDataCount!: number;
    public endDataOffset!: number;
    public unknownCount!: number;
    public name!: string;
    public faces!: Face[];
    public vertices!: VertexInfo[];

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.parseHeader();
    }

    read(fn: ReadBytesFunction, amt: number) {
        const value = fn.call(this.buffer, this.offset);
        this.offset += amt;
        return value;
    }

    readUInt16(): number {
        return this.read(this.buffer.readUInt16LE, 2);
    }

    readUInt32(): number {
        return this.read(this.buffer.readUInt32LE, 4);
    }

    readFloat32(): number {
        return this.read(this.buffer.readFloatLE, 4);
    }

    readNullTerminatedString(): string {
        let pos = this.offset;

        while (this.buffer[pos] !== 0 && pos < this.buffer.length) {
            pos++;
        }

        const str = this.buffer.toString('ascii', this.offset, pos);
        const size = str.length + 1;

        this.offset += size;

        return str;
    }

    parseHeader(): void {
        // First 8 bytes are always null
        this.offset = 8;

        // Assumed to be version
        const version = this.readUInt32();

        if (version !== 120) {
            throw new InvalidVersionError();
        }

        // More null/unknown values follow
        this.offset = 20;

        const meshHeaders: MeshHeader[] = [];

        for (let i = 0; i < 4; i++) {
            const header = new MeshHeader(
                this.readUInt32(),
                this.readUInt32(),
                this.readUInt32(),
                this.readUInt32(),
                this.readUInt32(),
            );

            if (i > 0) {
                const prevHeader = meshHeaders[i-1];

                if (!header.isEqualTo(prevHeader)) {
                    throw new InvalidMeshHeaderError();
                }
            }

            meshHeaders.push(header);
        }

        this.faceCount = meshHeaders[0].faceCount;
        this.vertexCount = meshHeaders[0].vertexCount;
        this.verticesOffset = meshHeaders[0].verticesOffset;
        this.facesOffset = meshHeaders[0].facesOffset;

        // Unknown value
        this.offset += 4;

        this.endDataCount = this.readUInt32();
        this.endDataOffset = this.readUInt32();

        // TODO: manual correction if necessary (see old implementation)

        // Another duplicate "faces offset" value
        if (this.readUInt32() !== this.facesOffset) {
            throw new InvalidMeshHeaderError('Faces offset mismatch');
        }

        this.unknownCount = this.readUInt32();  // seems close to faceCount in lfighter.ian
        this.name = this.readNullTerminatedString();
    }

    // Reads mesh data from the buffer, assigns it to the class instance, then returns it.
    parseData(): MeshData {
        this.faces = this.readFaces();
        this.vertices = this.readVerticies();
        this.hasParsedData = true;

        return {
            faces: this.faces,
            vertices: this.vertices,
        }
    }

    readFaces(): Face[] {
        const faces: Face[] = [];

        this.offset = this.facesOffset;

        for (let i = 0; i < this.faceCount; i++) {
            const unknown1 = this.readUInt16();
            const unknown2 = this.readUInt16();
            const indices: number[] = [];

            for (let i = 0; i < 3; i++) {
                indices.push(this.readUInt32());
                // Indices seem to be padded with 3 null bytes + 0xCD
                this.offset += 4;
            }

            faces.push({
                unknown1,
                unknown2,
                indices: [indices[0], indices[2], indices[1]],
            });
        }

        return faces;
    }

    readVerticies(): VertexInfo[] {
        const vertices: VertexInfo[] = [];

        this.offset = this.verticesOffset;

        for (let i = 0; i < this.vertexCount; i++) {
            vertices.push({
                x: this.readFloat32(),
                y: this.readFloat32(),
                z: this.readFloat32(),
                normals: [
                    this.readFloat32(),
                    this.readFloat32(),
                    this.readFloat32(),
                ],
                u: this.readFloat32(),
                v: 1 - this.readFloat32(),
            });
        }

        return vertices;
    }

    toOBJ(): string {
        const vertices: string[] = [];
        const uvs: string[] = [];
        const normals: string[] = [];
        const faces: string[] = [];

        if (!this.hasParsedData) {
            this.parseData();
        }

        this.faces.forEach(item => {
            const i1 = item.indices[0] + 1;
            const i2 = item.indices[1] + 1;
            const i3 = item.indices[2] + 1;
            faces.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
        });

        this.vertices.forEach(item => {
            vertices.push(`v ${item.x} ${-item.y} ${item.z}`);
            uvs.push(`vt ${item.u} ${item.v}`);
            normals.push(`vn ${item.normals.join(' ')}`);
        });

        return [
            `o ${this.name}`,
            ...vertices,
            ...uvs,
            ...normals,
            ...faces,
        ].join('\n');
    }
}
