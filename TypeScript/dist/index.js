"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_commander = require("commander");
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// src/errors/index.ts
var InvalidVersionError = class _InvalidVersionError extends Error {
  constructor(message = "Invalid file version") {
    super(message);
    this.name = "InvalidVersionError";
    Object.setPrototypeOf(this, _InvalidVersionError.prototype);
  }
};
var InvalidMeshHeaderError = class _InvalidMeshHeaderError extends Error {
  constructor(message = "Mesh header mismatch") {
    super(message);
    this.name = "InvalidMeshHeaderError";
    Object.setPrototypeOf(this, _InvalidMeshHeaderError.prototype);
  }
};

// src/models/index.ts
var MeshHeader = class {
  constructor(faceCount, vertexCount, verticesOffset, facesOffset, unknown) {
    this.faceCount = faceCount;
    this.vertexCount = vertexCount;
    this.verticesOffset = verticesOffset;
    this.facesOffset = facesOffset;
    this.unknown = unknown;
  }
  isEqualTo(other) {
    return this.faceCount === other.faceCount && this.vertexCount === other.vertexCount && this.verticesOffset === other.verticesOffset && this.facesOffset === other.facesOffset && this.unknown === other.unknown;
  }
};

// src/file-parser/index.ts
var IncomingModelFile = class {
  constructor(buffer2) {
    this.offset = 0;
    this.hasParsedData = false;
    this.buffer = buffer2;
    this.parseHeader();
  }
  read(fn, amt) {
    const value = fn.call(this.buffer, this.offset);
    this.offset += amt;
    return value;
  }
  readUInt16() {
    return this.read(this.buffer.readUInt16LE, 2);
  }
  readUInt32() {
    return this.read(this.buffer.readUInt32LE, 4);
  }
  readFloat32() {
    return this.read(this.buffer.readFloatLE, 4);
  }
  readNullTerminatedString() {
    let pos = this.offset;
    while (this.buffer[pos] !== 0 && pos < this.buffer.length) {
      pos++;
    }
    const str = this.buffer.toString("ascii", this.offset, pos);
    const size = str.length + 1;
    this.offset += size;
    return str;
  }
  parseHeader() {
    this.offset = 8;
    const version = this.readUInt32();
    if (version !== 120) {
      throw new InvalidVersionError();
    }
    this.offset = 20;
    const meshHeaders = [];
    for (let i = 0; i < 4; i++) {
      const header = new MeshHeader(
        this.readUInt32(),
        this.readUInt32(),
        this.readUInt32(),
        this.readUInt32(),
        this.readUInt32()
      );
      if (i > 0) {
        const prevHeader = meshHeaders[i - 1];
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
    this.offset += 4;
    this.endDataCount = this.readUInt32();
    this.endDataOffset = this.readUInt32();
    if (this.readUInt32() !== this.facesOffset) {
      throw new InvalidMeshHeaderError("Faces offset mismatch");
    }
    this.unknownCount = this.readUInt32();
    this.name = this.readNullTerminatedString();
  }
  // Reads mesh data from the buffer, assigns it to the class instance, then returns it.
  parseData() {
    this.faces = this.readFaces();
    this.vertices = this.readVerticies();
    this.hasParsedData = true;
    return {
      faces: this.faces,
      vertices: this.vertices
    };
  }
  readFaces() {
    const faces = [];
    this.offset = this.facesOffset;
    for (let i = 0; i < this.faceCount; i++) {
      const unknown1 = this.readUInt16();
      const unknown2 = this.readUInt16();
      const indices = [];
      for (let i2 = 0; i2 < 3; i2++) {
        indices.push(this.readUInt32());
        this.offset += 4;
      }
      faces.push({
        unknown1,
        unknown2,
        indices: [indices[0], indices[2], indices[1]]
      });
    }
    return faces;
  }
  readVerticies() {
    const vertices = [];
    this.offset = this.verticesOffset;
    for (let i = 0; i < this.vertexCount; i++) {
      vertices.push({
        x: this.readFloat32(),
        y: this.readFloat32(),
        z: this.readFloat32(),
        normals: [
          this.readFloat32(),
          this.readFloat32(),
          this.readFloat32()
        ],
        u: this.readFloat32(),
        v: 1 - this.readFloat32()
      });
    }
    return vertices;
  }
  toOBJ() {
    const vertices = [];
    const uvs = [];
    const normals = [];
    const faces = [];
    if (!this.hasParsedData) {
      this.parseData();
    }
    this.faces.forEach((item) => {
      const i1 = item.indices[0] + 1;
      const i2 = item.indices[1] + 1;
      const i3 = item.indices[2] + 1;
      faces.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
    });
    this.vertices.forEach((item) => {
      vertices.push(`v ${item.x} ${-item.y} ${item.z}`);
      uvs.push(`vt ${item.u} ${item.v}`);
      normals.push(`vn ${item.normals.join(" ")}`);
    });
    return [
      `o ${this.name}`,
      ...vertices,
      ...uvs,
      ...normals,
      ...faces
    ].join("\n");
  }
};

// src/index.ts
var name = import_path.default.basename(process.argv[1]);
var program = new import_commander.Command();
program.description("Parses 3D model data from Incoming's .ian format.");
program.addOption(new import_commander.Option("-e, --export <path>", ".ian file path (to convert to .obj)").conflicts("import"));
program.addOption(new import_commander.Option("-i, --import <path>", ".obj file path (to convert to .ian)").conflicts("export"));
program.requiredOption("-o, --output <path>", "Output path");
program.addHelpText("after", `
Example usage:
    >> ${name} --export lfighter.ian --output lfighter.obj
`);
program.parse(process.argv);
var options = program.opts();
if (!(options.export || options.import)) {
  console.error("error: --export or --import argument required");
  process.exit(1);
}
var inputPath = import_path.default.resolve(options.export || options.import);
var outputPath = import_path.default.resolve(options.output);
if (!import_fs.default.existsSync(inputPath)) {
  throw new Error(`File not found: ${inputPath}`);
}
var buffer = import_fs.default.readFileSync(inputPath);
if (options.export) {
  const incomingModel = new IncomingModelFile(buffer);
  const objData = incomingModel.toOBJ();
  import_fs.default.writeFileSync(outputPath, objData);
} else if (options.import) {
}
