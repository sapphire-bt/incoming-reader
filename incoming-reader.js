window.IncomingReader = function(arrayBuffer) {
    const self = this;

    this.dataView = new DataView(arrayBuffer);

    this.textDecoder = new TextDecoder();

    this.offset = 0;

    this.readIAN = function() {
        const data = {};

        self.offset = 0;

        // first 8 bytes always null
        self.offset += 8;

        // bytes 8-12 always 0x78 / 120 - version number?
        self.offset += 4;

        // bytes 12-16 seem random; may be some kind of ID
        self.offset += 4;

        // 16-20 always null
        self.offset += 4;

        // information about this mesh file (offsets, counts) - repeated 4 times, not sure why
        data.mesh_info = [];

        for (let i = 0; i < 4; i++) {
            data.mesh_info.push({
                face_count      : self.getUint32(),
                vertex_count    : self.getUint32(),
                vertices_offset : self.getUint32(),
                faces_offset    : self.getUint32(),
                unknown         : self.getUint32(),
            })
        }

        // ?
        self.offset += 2;
        self.offset += 2;

        // unknown_end_data_count
        data.unknown_end_data_count = self.getUint32();

        // offset to unknown stuff at end of file
        data.unknown_end_data_offset = self.getUint32();

        // not sure why this is necessary - seems to mostly be trees/bushes where this value is "wrong"
        if (data.unknown_end_data_offset > self.dataView.byteLength) {
            data.unknown_end_data_offset = data.mesh_info[0].vertices_offset + (data.mesh_info[0].vertex_count * 32);
        }

        // start of face indices
        data.faces_offset = self.getUint32();

        // ? usually 0 for trees/bushes etc.
        self.offset += 4;

        // name + null terminator
        data.name = self.getText();

        // faces consist of three indices + two unknown values, usually 3,3 - could be vertex count for this face?
        data.faces = [];

        for (let i = 0; i < data.mesh_info[0].face_count; i++) {
            const face = {};

            // these two unknown values usually seem to be 3,7 or 3,3
            face.unknown_1 = self.getUint16();
            face.unknown_2 = self.getUint16();

            face.indices = [];

            // indices seem to be padded with 3 null bytes + 0xCD
            const i1 = self.getUint32();
            self.offset += 4;

            const i2 = self.getUint32();
            self.offset += 4;

            const i3 = self.getUint32();
            self.offset += 4;

            // indices seem to draw faces "inside out" unless changed to 1/3/2 here
            face.indices.push(i1, i3, i2);

            data.faces.push(face);
        }

        data.vertices = [];

        for (let i = 0; i < data.mesh_info[0].vertex_count; i++) {
            const vertex = {};

            // position
            vertex.x = self.getFloat32();
            vertex.y = self.getFloat32();
            vertex.z = self.getFloat32();

            // normals? doesn't always seem to be the case (e.g. sphinx) unless values are rounded
            vertex.normal = [
                self.getFloat32(),
                self.getFloat32(),
                self.getFloat32(),
            ];

            // UV
            vertex.u = self.getFloat32();
            vertex.v = 1 - self.getFloat32(); // V seems to start at top of image, so flip here

            data.vertices.push(vertex);
        }

        // bounding box/sphere(s)?
        data.unknown_end_data = [];

        // unknown_end_data_count is sometimes slightly off, e.g. tree7.ian reads 18, but actual count is 16
        while (self.offset < self.dataView.byteLength) {
            try {
                const unknown = {};

                unknown.x = self.getFloat32();
                unknown.y = self.getFloat32();
                unknown.z = self.getFloat32();

                // padding bytes? always 0xCD
                self.offset += 20;

                data.unknown_end_data.push(unknown);
            } catch (e) {
                console.log(e);
                break;
            }
        }

        return data;
    }

    this.writeIAN = function(filename) {
        const obj = self.readOBJ();

        const fileSize = (
              8                             // null
            + 4                             // version
            + 4                             // ID
            + 4                             // null
            + (4 * 5 * 4)                   // offsets, counts, etc. x4
            + 2                             // ?
            + 2                             // ?
            + 4                             // unknown end data count
            + 4                             // unknown end data offset
            + 4                             // faces offset
            + 4                             // ?
            + filename.length               // model name
            + 1                             // null terminator
            + (obj.faces.length / 3) * (    // faces
                  2                         //     ?
                + 2                         //     ?
                + 8                         //     face index 1 + padding
                + 8                         //     face index 2 + padding
                + 8                         //     face index 3 + padding
            )
            + obj.faces_data.length * (     // grouped face info
                  4                         //     vertex 1
                + 4                         //     vertex 2
                + 4                         //     vertex 3
                + 4                         //     normal 1
                + 4                         //     normal 2
                + 4                         //     normal 3
                + 4                         //     U
                + 4                         //     V
            )
        );

        let offset = 8;

        const facesOffset    = 120 + filename.length + 1;
        const verticesOffset = facesOffset + (28 * (obj.faces.length / 3));

        const buffer = new ArrayBuffer(fileSize);
        const data   = new DataView(buffer);

        // ID
        data.setUint32(offset, 0x78000000);
        offset += 4;

        // Rand ID
        data.setUint32(offset, Math.floor(0xFFFFFFFF * Math.random()));
        offset += 4;

        // null
        offset += 4;

        // Offsets, counts, etc.
        for (let i = 0; i < 4; i++) {
            data.setUint32(offset + 0, obj.faces.length / 3, true);
            data.setUint32(offset + 4, obj.faces_data.length, true);
            data.setUint32(offset + 8, verticesOffset, true);
            data.setUint32(offset + 12, facesOffset, true);

            offset += 20;
        }

        // ?
        data.setUint32(offset, 0x0100AFDE);
        offset += 4;

        // test: skip unknown end data count/offset
        offset += 8;

        // face indices offset
        data.setUint32(offset, facesOffset, true);
        offset += 4;

        // test: skip unknown, usually 0 for trees/bushes etc.
        offset += 4;

        // name
        for (const c of filename) {
            data.setUint8(offset, c.codePointAt());
            offset += 1;
        }

        // null terminator
        offset += 1;

        // assign face indices
        for (let i = 0; i < obj.faces.length; i += 3) {
            const f1 = obj.faces[i + 0];
            const f2 = obj.faces[i + 2];
            const f3 = obj.faces[i + 1];

            data.setUint32(offset, 0x03000700);
            offset += 4;

            data.setUint32(offset, f1, true);
            offset += 4;

            data.setUint32(offset, 0x000000CD);
            offset += 4;

            data.setUint32(offset, f2, true);
            offset += 4;

            data.setUint32(offset, 0x000000CD);
            offset += 4;

            data.setUint32(offset, f3, true);
            offset += 4;

            data.setUint32(offset, 0x000000CD);
            offset += 4;
        }

        // assign grouped face data (vertices, normals, UVs)
        for (const faceData of obj.faces_data) {
            // X
            data.setFloat32(offset, faceData.vertex[0], true);
            offset += 4;

            // Y
            data.setFloat32(offset, faceData.vertex[1], true);
            offset += 4;

            // Z
            data.setFloat32(offset, faceData.vertex[2], true);
            offset += 4;

            // Normal 1
            data.setFloat32(offset, faceData.normal[0], true);
            offset += 4;

            // Normal 2
            data.setFloat32(offset, faceData.normal[1], true);
            offset += 4;

            // Normal 3
            data.setFloat32(offset, faceData.normal[2], true);
            offset += 4;

            // U
            data.setFloat32(offset, faceData.uv[0], true);
            offset += 4;

            // V
            data.setFloat32(offset, 1 - faceData.uv[1], true);
            offset += 4;
        }

        self.save(data, `${filename}.ian`, "octet/stream");
    }

    this.readOBJ = function() {
        const obj = {
            vertices            : [],
            normals             : [],
            uv                  : [],
            faces               : [],
            faces_data          : [],
            unique_face_indices : [],
        }

        const lines = self.textDecoder.decode(self.dataView).split("\n");

        for (let line of lines) {
            line = line.toLowerCase().trim();

            // Skip blank lines/comments
            if (line === "" || line.indexOf("#") === 0) continue;

            // Vertices
            if (line.indexOf("v ") === 0) {
                const vertex = line.substring(1).trim().split(" ").map(parseFloat);
                obj.vertices.push(vertex);
            }

            // Normals
            else if (line.indexOf("vn ") === 0) {
                const normal = line.substring(2).trim().split(" ").map(parseFloat);
                obj.normals.push(normal);
            }

            // UV
            else if (line.indexOf("vt ") === 0) {
                const uv = line.substring(2).trim().split(" ").map(parseFloat);
                obj.uv.push([uv[0], uv[1]]);
            }

            // Face indices
            else if (line.indexOf("f ") === 0) {
                const triplet = line.substring(1).trim().split(" ");

                for (const t of triplet) {
                    if (!obj.unique_face_indices.includes(t)) {
                        obj.unique_face_indices.push(t);

                        const indices = t.split("/").map(i => i - 1);

                        obj.faces_data.push({
                            vertex : obj.vertices[indices[0]],
                            uv     : obj.uv[indices[1]],
                            normal : obj.normals[indices[2]],
                        })
                    }

                    obj.faces.push(obj.unique_face_indices.indexOf(t));
                }
            }
        }

        return obj;
    }

    this.writeOBJ = function(filename) {
        const mesh = self.readIAN();
        const obj = [];

        const vertices = [];
        const uvs      = [];
        const normals  = [];
        const faces    = [];

        obj.push(`o ${mesh.name}`);

        for (const v of mesh.vertices) {
            vertices.push(`v ${v.x} ${v.y} ${v.z}`);

            uvs.push(`vt ${v.u} ${v.v}`);

            normals.push(`vn ${v.normal.join(" ")}`);
        }

        for (const f of mesh.faces) {
            const i1 = f.indices[0] + 1;
            const i2 = f.indices[1] + 1;
            const i3 = f.indices[2] + 1;

            faces.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
        }

        obj.push(...vertices);
        obj.push(...uvs);
        obj.push(...normals);
        obj.push(...faces);

        self.save(obj.join("\n"), `${filename}.obj`, "text/plain");
    }

    this.save = function(data, filename, type) {
        const blob = new Blob([data], {
            type: type
        })

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();

        window.URL.revokeObjectURL(url);
    }

    this.getInt8 = function() {
        const value = self.dataView.getInt8(self.offset);
        self.offset += 1;
        return value;
    }

    this.getUint8 = function() {
        const value = self.dataView.getUint8(self.offset);
        self.offset += 1;
        return value;
    }

    this.getInt16 = function() {
        const value = self.dataView.getInt16(self.offset, true);
        self.offset += 2;
        return value;
    }

    this.getUint16 = function() {
        const value = self.dataView.getUint16(self.offset, true);
        self.offset += 2;
        return value;
    }

    this.getInt32 = function() {
        const value = self.dataView.getInt32(self.offset, true);
        self.offset += 4;
        return value;
    }

    this.getUint32 = function() {
        const value = self.dataView.getUint32(self.offset, true);
        self.offset += 4;
        return value;
    }

    this.getFloat32 = function() {
        const value = self.dataView.getFloat32(self.offset, true);
        self.offset += 4;
        return value;
    }

    this.getText = function() {
        let data = [];
        let byte = self.getUint8();

        while (byte !== 0x00) {
            data.push(byte);
            byte = self.getUint8();
        }

        data = new Uint8Array(data);

        return self.textDecoder.decode(data);
    }
}
