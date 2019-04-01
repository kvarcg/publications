// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the code for vertex creation:
// 1. Vertex			- the vertex structure
// 2. getVertexPosition	- return the vertex position
// 3. createVertex 		- creates a vertex using the information in the A-buffer

#line 9

// Vertex data structure
// This structure contains the vertex information required for tracing/shading
struct Vertex
{	
	float reflectivity;
	vec3 position;
	float roughness;
	vec4 color;					
	vec3 normal;		
	float metal;
	float ior;
	float opacity;
	bool transmission;
	float optical_thickness;
	int face;
#ifdef LAYER_VISUALIZATION
	int depth_layer;
#endif
};

// Creates a vertex
// Parameters:
// - vertex_coords, the coordinates of the vertex
// - id, the node index
// - index, the view index
// returns the vertex for the requested node
Vertex createVertex(vec2 vertex_coords, uint id, int index
#ifdef LAYER_VISUALIZATION
, int depth_layer
#endif
)
{
	Vertex vertex;
	// the current position
	NodeTypeLL_Double node_id		= nodes[id];
	NodeTypeData node				= data[id];
	float pndcZ						= projectZ(node_id.depth, index);

	vec2 normal_packed 				= unpackUnorm2x16(node.normal);
	vec4 spec_parameters			= unpackUnorm4x8(node.specular);
	vec4 ior_opacity 				= unpackUnorm4x8(node.ior_opacity);
	vertex.color 					= unpackUnorm4x8(node.albedo);
	vec2 texcoord					= vec2(vertex_coords.xy) / uniform_viewports[index];

	vertex.position					= reconstruct_position_from_depth(texcoord.xy, pndcZ, index);
	vertex.normal				 	= normal_decode_spheremap1(normal_packed.rg);	
	vertex.reflectivity				= spec_parameters.x;
	vertex.roughness				= 1.0 - spec_parameters.y;
	vertex.metal					= spec_parameters.z;

	if (ior_opacity.z > 0.0)
	vertex.color.a					*= EMISSION_MULT;

	// scale ior to its original value
	vertex.ior						= ior_opacity.x * 10.0;
	vertex.opacity					= ior_opacity.y;
	vertex.transmission				= false;
	vertex.optical_thickness		= 1;//exp(-0.1);
	vertex.face						= index;
	
// change material parameters for test rays
#if defined TEST_DIFFUSE_RAYS
	vertex.roughness				= 0.9;
	vertex.reflectivity				= 0.05;
	vertex.metal					= 0.0;
#elif defined TEST_GLOSSY_RAYS
	vertex.roughness				= 0.1;
	if	(vertex.metal == 0.0)
		vertex.reflectivity				= 0.1;
#elif defined TEST_REFLECTION_RAYS
	vertex.roughness				= 0.0;
	if	(vertex.metal == 0.0)
		vertex.reflectivity				= 0.1;
#endif
	

#ifdef LAYER_VISUALIZATION
	vertex.depth_layer				= depth_layer;
#endif

	if (index > 0)
	{
		vertex.position				= vec3(uniform_view[0] * uniform_view_inverse[vertex.face] * vec4(vertex.position, 1)).xyz;
		vertex.normal				= vec3(uniform_view[0] * uniform_view_inverse[vertex.face] * vec4(vertex.normal, 0)).xyz;
	}

	return vertex;
}