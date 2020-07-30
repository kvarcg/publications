// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the structs used in DIRT and the associated packing routines

#line 6

// Geometry (vertex) Buffer: Stores primitive data. This is not necessary as it is already provided by OpenGL. 
// However, I am storing additional information (e.g., triangle edges) for performance reasons.
// Size: 12 * 4 * sizeof(float) = 334 bytes
struct NodeTypePrimitive
{
	vec4 vertex1;
	vec4 vertex2;
	vec4 vertex3;

	vec4 normal2_tangent1x;
	vec4 normal3_tangent1y;

	vec4 tangent2_tangent1z;
	vec4 tangent3;

	vec4 texcoord1_texcoord2;
	vec4 texcoord3;

	vec4 e_1;
	vec4 e_2;
	vec4 fn;
};

// ID Buffer
// Simple linked-list containing data required for tracing:
// - primitive id
// - the next pointer
// Size: 1 * sizeof(float) + 2 * sizeof(uint) = 12 bytes
struct NodeTypeTrace
{
	uint	primitive_id;
	uint	next;
};

// Hit Buffer
// Simple linked-list containing the hit records:
// - the primitive id
// - next pointer
// - the owner (the pixel location in the shading buffer, i.e., where the ray originated from)
// - extra_data, storing extra information relevant to the hit point, such as the hit's barycentric coordinates, etc.
// Size: 2 * sizeof(uint) + 4 * sizeof(float) = 24 bytes
struct NodeTypeHit
{
	uint	next;
	uint	primitive_id;
	vec2	owner;
	vec4	extra_data;
};

#define __PACKING__
// Shading buffer
// Material data structure containing information for each one of the three points of each event
// Ideally, the previous point only requires the position.
// Both packed and unpacked versions can be used, exchanging quality/precision for memory and performance.
// Size: PACKED: 4 * sizeof(uint) + 1 * sizeof(float) = 20 bytes
// Size: UNPACKED: 4 * 5 * sizeof(float) = 80 bytes
struct NodeTypeShading
{
#ifdef NO_PACKING
	vec4	albedo;
	vec4	normal_em;
	vec4	specular_ior;
	vec4	extra;
#else
	uint	albedo;
	uint	normal;
	uint	specular;
	uint	ior_opacity;
#endif // NO_PACKING
	vec4	position;
};

// Packs the primitive id and view index in a uint
// Parameters:
// - primitive_id, the primitive id
// - cubeindex, the view index
// Returns a uint where the first 3 bits contain the view index and the rest the primitive id
uint pack_prim_id_cubeindex(in uint primitive_id, in int cubeindex)
{
	return primitive_id << 3 | uint(cubeindex);
}

// Extracts the primitive id and the cubeindex from the packed uint
// Parameters:
// - primitive_id, the primitive id
// - cubeindex, the view index
// Returns the unpacked values
uvec2 unpack_prim_id_cubeindex(in uint packed_value)
{
	uvec2 unpacked;
	unpacked.x = packed_value >> 3;
	unpacked.y = packed_value - (unpacked.x << 3);
	return unpacked;
}