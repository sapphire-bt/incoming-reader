# Incoming .IAN Reader
This is a JavaScript plugin for reading/writing .IAN files: a simple proprietary 3D model format used for the 1998 video game [Incoming](https://en.wikipedia.org/wiki/Incoming_(1998_video_game)).

This format was reverse engineered without a debugger/disassembler; as a result there are still values whose purpose is unknown. These values aren't included in the data returned by the plugin but guesses as to what they are can be found in the source code.

A Python script is also included for batch exporting to OBJ format.

## Key Features
* File data can be used with [three.js](https://threejs.org/) to render models in-browser:

!["Light Fighter" model shown in three.js](https://www.bunnytrack.net/images/github/incoming/test.gif)

* Convert between IAN and OBJ, allowing for custom in-game models and model export to programs such as Blender, Maya, etc.

!["Light Fighter" model shown in Blender](https://www.bunnytrack.net/images/github/incoming/blender.jpg)

* OBJ files can be converted to IAN format allowing custom models in-game:

![Custom model in-game](https://www.bunnytrack.net/images/github/incoming/custom.png)

## How to Use
Include `incoming-reader.js` in the page and pass an `ArrayBuffer` of the .IAN file to the global `IncomingReader` function:

```html
<input type="file" id="file-input" />

<script src="incoming-reader.js"></script>
<script>
    document.getElementById("file-input").addEventListener("input", function() {
        for (const file of this.files) {
            const fileReader = new FileReader();

            fileReader.onload = function() {
                const incomingReader = new IncomingReader(this.result);
            }

            fileReader.readAsArrayBuffer(file);
        }
    })
</script>
```

## Methods

### `readIAN()` returns *Object*
Returns an object containing the following:

| Name                      | Type     | Description
| ---                       | ---      | ---
| `mesh_info`               | _Array_  | Contains four identical objects, each containing: <ul><li>`face_count`</li><li>`vertex_count`</li><li>`vertices_offset`</li><li>`faces_offset`</li><li>`unknown`</li></ul> Every .IAN file seems to repeat this four times.
| `unknown_end_data_count`  | _Number_ | Appears to be a count of data at the end of the file. These values may be bounding box vertices, but I'm not sure. The count also appears to be occasionally incorrect, e.g. tree7.ian reads 18, but the actual count is 16.
| `unknown_end_data_offset` | _Number_ | Offset to unknown end data.
| `faces_offset`            | _Number_ | Offset to face indices (same value as repeated four times in `mesh_info`).
| `name`                    | _String_ | Model name. Not always descriptive (e.g. "Object01").
| `faces`                   | _Array_  | An array of objects, each containing: <ul><li>`unknown_1`</li><li>`unknown_2`</li><li>`indices`</li></ul> `indices` is an array of three indices into the `vertices` data. The two unknown values are usually 3, or 3 and 7. They do not appear to affect the model if set to null.
| `vertices`                | _Array_  | An array of objects, each containing: <ul><li>`x`</li><li>`y`</li><li>`z`</li><li>`normal`</li><li>`u`</li><li>`v`</li></ul> `normal` is an array containing 3 values, e.g. `[0, -1, 0]`.
| `unknown_end_data`        | _Array_  | See above.

---

### `writeIAN(filename : String)`
Converts an OBJ file to IAN format.

Pass an OBJ file `ArrayBuffer` to the plugin and call `incomingReader.writeIAN("my_model")`. This will prompt a download from a [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) object URL.

It is recommended to export a default IAN file and keep your model to roughly the same size.

---

### `writeOBJ(filename : String)`
Converts an IAN file to OBJ format.

Pass an IAN file `ArrayBuffer` to the plugin and call `incomingReader.writeOBJ("my_model")`. This will prompt a download from a `Blob` object URL.

## Additional Information

### Overview
The game assets are contained in the following folders (typically located at `C:\Program Files (x86)\Incoming`):

    Incoming/
    ├── asc/
    ├── pcobject/
    ├── ppm/
    └── wavs/

See the sections below for further details on each folder.

### "asc" Folder
Contains several files related to the levels of the game, each contained in its own folder. The folder for the first level, *Africa*, contains:

    Incoming/
    └── asc/
        └── africa/
            ├── africa.mdl
            ├── africa.odl
            ├── africa.wdl
            ├── africa_action.mdl
            ├── africa_virus.mdl
            ├── africa_virus.odl
            ├── city2tc.bin
            └── tland1.bin

A brief overview of the file types:

| File          | Description
| ---           | ---
| `*.mdl`       | A series of procedures describing each mission, including spawn positions of enemies, camera positions, and which speech files to play.
| `*.odl`       | A list of permitted models (vehicles and scenery) for this level. Basic values for the environment are also present such as RGB and fog values for the sky, as well as a list of terrain textures.
| `*.wdl`       | A list of level scenery and where to spawn the models.
| `city2tc.bin` | Texture positions/properties for each square tile of the level (see below).
| `tland1.bin`  | A [heightmap](https://en.wikipedia.org/wiki/Heightmap) for the terrain (see below).

#### city2tc.bin
These files consist of 128 blocks of 256 bytes. Each block corresponds to one column of the terrain, starting from north west, going across. Two bytes are used to describe the texture information for each square, which means each level is a 128×128 grid.

An excerpt from Africa's file, split into rows of two bytes:

    85 00
    05 00
    86 00
    06 00

The first byte contains two values: the texture index, and its position. Levels use eight textures for terrain which are specified inside the `.odl` file.

The texture index is determined by the first four bits. One way to obtain the index is to use a bitwise AND:

```js
0x85 & 0xF // 5
0x05 & 0xF // 5
0x86 & 0xF // 6
0x06 & 0xF // 6
```

Textures are zero-indexed.

The texture position is determined by the last four bits. A bitwise AND can be used here again:

```js
0x85 & 0xF0 // 8
0x05 & 0xF0 // 0
0x86 & 0xF0 // 8
0x06 & 0xF0 // 0
```

Terrain textures are 256×256px, however only a quarter (128×128px) segment is shown per tile. There are 16 possible positions (highlighted by the red square):

| Value  | Position
| ---    | ---
| `0x00` | ![Position 1](https://i.imgur.com/GpEtcmf.png)
| `0x10` | ![Position 2](https://i.imgur.com/AYjBWeT.png)
| `0x20` | ![Position 3](https://i.imgur.com/T0zVo3d.png)
| `0x30` | ![Position 4](https://i.imgur.com/NU3iPuc.png)
| `0x40` | ![Position 5](https://i.imgur.com/OHWU6fK.png)
| `0x50` | ![Position 6](https://i.imgur.com/tScH4nE.png)
| `0x60` | ![Position 7](https://i.imgur.com/LJx2van.png)
| `0x70` | ![Position 8](https://i.imgur.com/YvNoFVS.png)
| `0x80` | ![Position 9](https://i.imgur.com/OVyUrgG.png)
| `0x90` | ![Position 10](https://i.imgur.com/Gkw86Bi.png)
| `0xA0` | ![Position 11](https://i.imgur.com/uQCOYTj.png)
| `0xB0` | ![Position 12](https://i.imgur.com/6reACXD.png)
| `0xC0` | ![Position 13](https://i.imgur.com/neWod5M.png)
| `0xD0` | ![Position 14](https://i.imgur.com/mQDiKbk.png)
| `0xE0` | ![Position 15](https://i.imgur.com/0lK4PFK.png)
| `0xF0` | ![Position 16](https://i.imgur.com/n17YSvy.png)

The second byte is a [bitmask](https://en.wikipedia.org/wiki/Mask_(computing)) of texture properties, such as rotation/mirroring:

| Value  | Description
| ---    | ---
| `0x01` | Flip horizontally.
| `0x02` | Flip vertically.
| `0x04` | Rotate 90° clockwise.
| `0x08` | Rotate 180° clockwise.
| `0x10` | Unknown; may be used for tiles which should contain water in the oceanic level.
| `0x20` | Unknown; used heavily in the oceanic level.
| `0x40` | No visible effect.
| `0x80` | No visible effect.

#### tland1.bin
As mentioned, this file solely consist of height values for the terrain which is used to modify a flat plane. Each height value is a 16-bit signed integer, resulting in a 513×513 grid of values. Height values seem to be negative in Incoming, so these values would need to be inverted if used for drawing terrain.

An example applying the Moon level's values to a plane using three.js is shown below:

!["Moon" heightmap wireframe](https://i.imgur.com/3ykn3ir.png)
!["Moon" heightmap with simple texture mapping](https://i.imgur.com/TvwLAhK.jpg)

---

### "pcobject" Folder
Contains all model files. Alien models are stored in "cweapons" whereas allied models can be found in "pweapons".

[LOD](https://en.wikipedia.org/wiki/Level_of_detail) meshes can be found within "low" folders in each directory.

Models displaying different levels of damage are separated into folders corresponding to the amount of damage (ranging from 1-3, with 3 being the most damaged).

---

### "ppm" Folder
Contains all texture files. Textures are encoded as [PPM](https://en.wikipedia.org/wiki/Netpbm) files, an open-source bitmap format.

---

### "wavs" Folder
Contains all sound files. Sounds are stored in [WAV](https://en.wikipedia.org/wiki/WAV) format. All sounds appear to be monophonic 22.05 kHz / 16-bit.

## Unknown
Yet to be figured out is the purpose of the `.ctl` files inside the `Incoming\asc\pads\` folder. As the name indicates, these may be related to healing pads.
