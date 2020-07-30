// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the structs used in MMRT

#line 6

// ID Buffer
// Double linked-list containing data required for sorting and tracing
// depth, the eye-space Z value
// the next pointer
// the prev pointer (for efficient bidirectional traversal)
// Size: 1 * sizeof(float) + 2 * sizeof(uint) = 12 bytes
struct NodeTypeLL_Double
{
	float	depth;

	uint next;
	uint prev;
};

// Data Buffer
// The material information required for illumination computations
// This data can be packed or unpacked
// Current implementation uses only packed data
// Size: 4 * sizeof(uint) = 16 bytes
struct NodeTypeData
{
	uint	albedo;
	uint	normal;
	uint	specular;
	uint	ior_opacity;
};