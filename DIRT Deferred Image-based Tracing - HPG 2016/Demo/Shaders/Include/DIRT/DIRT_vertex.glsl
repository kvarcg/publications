// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the code for vertex creation:
// 1. Vertex			- the vertex structure
// 2. getVertexPosition	- return the vertex position
// 3. createVertex 		- creates a vertex using the information in the id and shading buffer+

#line 9

// Vertex data structure
// This structure contains the vertex information required for tracing/shading
struct Vertex
{
#if defined SHADING_STAGE || (!defined (TEST_VISIBILITY_RAYS) && !defined (TEST_REFLECTION_RAYS) && !defined (TEST_GLOSSY_RAYS))
	vec4 color;				
	float reflectivity;
	float roughness;
	float metal;
	float ior;
	float opacity;
	bool transmission;
	float optical_thickness;
	vec3 normal;
// VARIOUS TEST RAYS FOR TRACING_STAGE
#elif defined TEST_GLOSSY_RAYS
	float reflectivity;
	float roughness;
	vec3 normal;
	float metal;
	float ior;
#elif defined TEST_REFLECTION_RAYS
	vec3 normal;
#elif defined TEST_VISIBILITY_RAYS
	vec3 normal;
#endif // SHADING_STAGE

	// which face this vertex belongs to
	int face;			
	vec3 position;

	uint prim_id;
};

// Retrieves the vertex position of a node
// Parameters:
// - index, the node index
// returns the vertex position in eye space
vec3 getVertexPosition(uint index)
{
	NodeTypeShading node_shading	= nodes_shading[index];
	// extract the primitive id and the cubeindex
	uvec2 prim_id_cube				= unpack_prim_id_cubeindex(floatBitsToUint(node_shading.position.w));
	int face						= int(prim_id_cube.y);
	float pndcZ						= projectZ(node_shading.position.z, face);
	vec3 pos_ecs					= node_shading.position.xyz;
	
	if (face > 0)
		pos_ecs = vec3(uniform_view[0] * uniform_view_inverse[face] * vec4(pos_ecs, 1)).xyz;

	return pos_ecs;
}

// Creates a vertex
// Parameters:
// - index, the node index
// returns the vertex for the requested node
Vertex createVertex(uint index)
{
	Vertex vertex;
	// the current position
	NodeTypeShading node_shading	= nodes_shading[index];

	// extract the primitive id and the cubeindex
	uvec2 prim_id_cube				= unpack_prim_id_cubeindex(floatBitsToUint(node_shading.position.w));
	vertex.face						= int(prim_id_cube.y);
	vertex.prim_id					= prim_id_cube.x;

	float pndcZ						= projectZ(node_shading.position.z, vertex.face);

#ifdef NO_PACKING
#if defined SHADING_STAGE ||(!defined (TEST_VISIBILITY_RAYS) && !defined (TEST_REFLECTION_RAYS) && !defined (TEST_GLOSSY_RAYS))
	vertex.color.rgb				= node_shading.albedo.rgb;
	vertex.opacity					= node_shading.albedo.a;
	vertex.color.a					= node_shading.normal_em.a;
	vertex.normal					= node_shading.normal_em.xyz;	
	vertex.roughness				= 1.0 - node_shading.specular_ior.y;
	vertex.reflectivity				= node_shading.specular_ior.x;
	vertex.metal					= node_shading.specular_ior.z;
	vertex.ior						= node_shading.specular_ior.w;
	vertex.transmission				= false;
// VARIOUS TEST RAYS FOR TRACING_STAGE
#elif defined TEST_GLOSSY_RAYS
	vertex.normal					= node_shading.normal_em.xyz;	
	vertex.roughness				= 1.0 - node_shading.specular_ior.y;
	vertex.reflectivity				= node_shading.specular_ior.x;
	vertex.metal					= node_shading.specular_ior.z;
	vertex.ior						= node_shading.specular_ior.w;
#elif defined TEST_REFLECTION_RAYS
	vertex.normal					= node_shading.normal_em.xyz;	
#elif defined TEST_VISIBILITY_RAYS
	vertex.normal					= node_shading.normal_em.xyz;	
#endif // SHADING_STAGE

#else // PACKING

#if defined SHADING_STAGE ||(!defined (TEST_VISIBILITY_RAYS) && !defined (TEST_REFLECTION_RAYS) && !defined (TEST_GLOSSY_RAYS))
	vertex.color 					= unpackUnorm4x8(node_shading.albedo);
	vec2 normal_packed 				= unpackUnorm2x16(node_shading.normal);
	vec4 spec_parameters			= unpackUnorm4x8(node_shading.specular);
	vec4 ior_opacity 				= unpackUnorm4x8(node_shading.ior_opacity);
	vertex.normal				 	= normal_decode_spheremap1(normal_packed.rg);	
	// scale ior to its original value
	vertex.ior						= ior_opacity.x * 10.0;
	if (ior_opacity.z > 0.0)
		vertex.color.a					*= EMISSION_MULT;	
	vertex.opacity					= ior_opacity.y;
	vertex.roughness				= 1.0 - spec_parameters.y;
	vertex.transmission				= false;//spec_parameters.w > 0.0;
	vertex.reflectivity				= spec_parameters.x;
	vertex.metal					= spec_parameters.z;
	// VARIOUS TEST RAYS FOR TRACING_STAGE	
#elif defined TEST_GLOSSY_RAYS
	vec2 normal_packed 				= unpackUnorm2x16(node_shading.normal);
	vec4 spec_parameters			= unpackUnorm4x8(node_shading.specular);
	vertex.normal				 	= normal_decode_spheremap1(normal_packed.rg);	
	vertex.roughness				= 1.0 - spec_parameters.y;
	vertex.reflectivity				= spec_parameters.x;
#elif defined TEST_REFLECTION_RAYS
	vec2 normal_packed 				= unpackUnorm2x16(node_shading.normal);
	vertex.normal				 	= normal_decode_spheremap1(normal_packed.rg);	
#elif defined TEST_VISIBILITY_RAYS
	vec2 normal_packed 				= unpackUnorm2x16(node_shading.normal);
	vertex.normal				 	= normal_decode_spheremap1(normal_packed.rg);	
#endif // SHADING_STAGE
#endif // NO_PACKING
	
	vertex.position					= node_shading.position.xyz;
	
	// these are needed only during shading
#ifdef SHADING_STAGE
	vertex.optical_thickness		= 1;//exp(-0.1);

#endif // SHADING_STAGE

// change material parameters for test rays
#if defined TEST_DIFFUSE_RAYS
	vertex.roughness				= 0.9;
	vertex.reflectivity				= 0.05;
	vertex.metal					= 0.0;
#elif defined TEST_GLOSSY_RAYS
	vertex.roughness				= 0.1;
	if	(vertex.metal == 0.0)
		vertex.reflectivity				= 0.1;
#elif defined TEST_REFLECTION_RAYS && defined (SHADING_STAGE)
	vertex.roughness				= 0.0;
	if	(vertex.metal == 0.0)
		vertex.reflectivity				= 0.1;
#endif
	
	if (vertex.face > 0)
	{
		vertex.position				= vec3(uniform_view[0] * uniform_view_inverse[vertex.face] * vec4(vertex.position, 1)).xyz;
		vertex.normal				= vec3(uniform_view[0] * uniform_view_inverse[vertex.face] * vec4(vertex.normal, 0)).xyz;
	}	
	return vertex;
}
