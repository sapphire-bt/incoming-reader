import os
import struct
import sys
import time

def main():
	input_folder  = None
	output_folder = None

	ian_files = []

	try:
		input_folder = sys.argv[1]

		if len(sys.argv) > 2:
			output_folder = sys.argv[2]
		else:
			output_folder = os.path.join(os.getcwd(), f"ian_export_{int(time.time())}")
			log(f"No output folder specified; using path {output_folder}")
	except Exception as e:
		print(f"Usage: {sys.argv[0]} <input folder path> [<output folder path>]")
		print(f'e.g. {sys.argv[0]} "./Incoming/pcobject/"')
		exit()

	if not os.path.exists(input_folder):
		log(f'Specified input folder does not exist: "{input_folder}"')
		exit()

	log("Scanning input folder for .ian files...")

	for root, directories, filenames in os.walk(input_folder):
		for filename in filenames:
			name, ext = os.path.splitext(filename)

			if ext.lower() == ".ian":
				filepath = os.path.join(root, filename)
				ian_files.append(filepath)

	if not ian_files:
		log("No .ian files found")
		exit()

	i = 0
	total = len(ian_files)

	log(f"Found {total} .ian file(s)")

	for filepath in ian_files:
		# Create output path name (must be a better way of doing this...)
		abs_input_folder = os.path.abspath(input_folder)
		abs_filepath     = os.path.abspath(filepath)
		output_path      = os.path.join(output_folder, abs_filepath[len(abs_input_folder):].strip(os.path.sep))
		output_dir       = os.path.dirname(output_path)
		name, ext        = os.path.splitext(output_path)

		if not os.path.exists(output_dir):
			os.makedirs(output_dir)

		log(f"Processing file {i+1}/{total}")

		# Read .ian data
		ian_data = parse_ian_file(filepath)

		# Convert to .obj
		ian_to_obj(ian_data, name + ".obj")

		i += 1

	log(f"Finished processing {i} .ian file(s)")

def parse_ian_file(filepath):
	log(f'Reading file "{filepath}" ...')

	faces    = []
	vertices = []
	normals  = []
	uvs      = []

	with open(filepath, "rb") as f:
		ian_data = f.read()

		f.seek(0x14)

		face_count = struct.unpack("<H", f.read(2))[0]
		f.seek(2, 1)

		vertex_count = struct.unpack("<H", f.read(2))[0]
		f.seek(2, 1)

		vertices_offset = struct.unpack("<H", f.read(2))[0]
		f.seek(2, 1)

		faces_offset = struct.unpack("<H", f.read(2))[0]
		f.seek(2, 1)

		log(f"Faces count     : {face_count}")
		log(f"Faces offset    : {faces_offset}")
		log(f"Vertices count  : {vertex_count}")
		log(f"Vertices offset : {vertices_offset}")

		f.seek(0x44, 1)

		unknown_end_data_count  = struct.unpack("<H", f.read(2))[0]
		f.seek(2, 1)

		unknown_end_data_offset = struct.unpack("<H", f.read(2))[0]
		f.seek(2, 1)

		if unknown_end_data_offset > len(ian_data):
			unknown_end_data_offset = vertices_offset + vertex_count * 32

		f.seek(faces_offset)

		log("Reading faces...")

		for i in range(face_count):
			f.seek(4, 1)

			f1 = struct.unpack("<I", f.read(4))[0]
			f.seek(4, 1)

			f2 = struct.unpack("<I", f.read(4))[0]
			f.seek(4, 1)

			f3 = struct.unpack("<I", f.read(4))[0]
			f.seek(4, 1)

			faces.append((f1, f3, f2))

		log("Done")

		f.seek(vertices_offset)

		log("Reading vertices, normals, and UVs...")

		for i in range(vertex_count):
			x = struct.unpack("<f", f.read(4))[0]
			y = struct.unpack("<f", f.read(4))[0]
			z = struct.unpack("<f", f.read(4))[0]

			vertices.append((x, y, z))

			n_1 = struct.unpack("<f", f.read(4))[0]
			n_2 = struct.unpack("<f", f.read(4))[0]
			n_3 = struct.unpack("<f", f.read(4))[0]

			normals.append((n_1, n_2, n_3))

			u = struct.unpack("<f", f.read(4))[0]
			v = 1 - struct.unpack("<f", f.read(4))[0]

			uvs.append((u, v))

		log("Done")

		return {
			"faces"    : faces,
			"vertices" : vertices,
			"normals"  : normals,
			"uvs"      : uvs
		}

def ian_to_obj(ian_data, output_path):
	log("Creating .obj file...")

	name, ext = os.path.splitext(os.path.basename(output_path))

	obj = []

	obj.append(f"o {name}")

	for vertex in ian_data["vertices"]:
		obj.append(f"v {vertex[0]} {vertex[1]} {vertex[2]}")

	for uv in ian_data["uvs"]:
		obj.append(f"vt {uv[0]} {uv[1]}")

	for normal in ian_data["normals"]:
		obj.append(f"vn {normal[0]} {normal[1]} {normal[2]}")

	for face in ian_data["faces"]:
		f1 = face[0] + 1
		f2 = face[1] + 1
		f3 = face[2] + 1

		obj.append(f"f {f1}/{f1}/{f1} {f2}/{f2}/{f2} {f3}/{f3}/{f3}")

	obj = "\n".join(obj)

	with open(output_path, "w", encoding = "utf-8") as f:
		f.write(obj)

	log("Done")
	log(f"Saved as {output_path}")
	print()

def log(msg):
	print(f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] {msg}')

if __name__ == "__main__":
	main()