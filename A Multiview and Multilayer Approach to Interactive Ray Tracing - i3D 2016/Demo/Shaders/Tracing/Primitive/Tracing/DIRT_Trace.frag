// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Traversal stage
// First, the shading buffer contents G[k] for the current pixel (gl_FragCoord.xy) are fetched
// Then, a new ray direction is generated (e.g. based on BSDF sampling) and is probability is also retrieved
// The new ray is traced:
// (i) hierarchically in screen space - empty regions are skipped via the depth texture
// (ii) in the depth intervals it intersects in depth space (for each pixel sample) - non intersected depth intervals (buckets) are skipped
// (iii) in the id buffer, for each intersected depth interval, by performing analytic intersection tests between the ray and the stored primitive in the id buffer
// If a hit occurs, a hit record is created in the hit buffer at the intersection location. This way, a rasterization pass can be initiated later on to fetch the shading attributes.
// The hit record also stores the current pixel (gl_FragCoord.xy), as the owner. This way, the interpolated data during the Fetch pass will be stored at the position the tracing started.
// Storing the shading information this way, allows for an easy illumination pass during the last pass, called the Shade pass.
// Finally, the probability is stored in the operators_probabilities texture to be used during the Shade pass for correct path tracing computations
// Note:
// - Since the id buffer can be downscaled, holding primitive data at a tile of size larger than 1x1 pixels (e.g. tile size:2x2 which is lod level 1). So, hierarchical traversal occurs as usual but stops at a higher lod level than 0 (e.g. at lod=1). This is the only practical difference during the Traversal stage.

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

in vec2 TexCoord; 
#ifdef DEPTH_MASK
layout (early_fragment_tests) in;								// the bound depth mask is used here a pixel rejection mechanism (only applied on > 1 bounces)
#endif

// stores the cumulative operators and probabilities
// layer 1 stores debug text data and layer 2 stores debug color data
layout(binding = 0, rgba32f)	coherent	uniform image2DArray	image_operators_probabilities;

// image bindings																									 // the transport operators texture
layout(binding = 1, r32ui )	coherent uniform uimage2DArray  image_hit_buffer_head;									 // the hit buffer head id texture
layout(binding = 2, std430)		coherent buffer  LLD_SHADING	 { NodeTypeShading		nodes_shading []; };		 // the shading buffer
layout(binding = 3, std430)		readonly buffer  LLD_ID			 { NodeTypeTrace		nodes[]; };					 // the id buffer
layout(binding = 4, std430)		writeonly buffer LLD_HIT		 { NodeTypeHit			nodes_peel[]; };			 // the hit buffer
layout(binding = 5, std430)		readonly buffer  LLD_PRIMITIVE	 { NodeTypePrimitive nodes_primitives[]; };			 // the vertex buffer
layout(binding = 6, offset = 0)		   uniform atomic_uint		  next_address;										 // the next address counter for the hit buffer
layout(binding = 11) uniform sampler2DArray tex_depth_bounds;														 // the depth bounds texture, used for HiZ
layout(binding = 12) uniform usampler2DArray tex_head_id_buffer;													 // the id buffer head id texture

#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#define NUM_MEMORY_CUBEMAPS		__NUM_FACES__
#define OPERATORS_LAYER 0
#define DEBUG_LAYER 1
#define STATISTICS_LAYER 2
#define FINAL_VIEW_LAYER 3
#define RAY_OFFSET_LAYER 4


// gets the id buffer head for the current pixel
#define PEEL_HEAD_LAYER_OFFSET 1
uint  getPixelHeadidBuffer	(const ivec2 coords, const int b) { return	texelFetch(tex_head_id_buffer	, ivec3(coords, PEEL_HEAD_LAYER_OFFSET + b), 0).x; }

// gets the hit buffer head for the current pixel
#define PEEL_HEAD_LAYER 0
uint  getPixelHeadHitBuffer	(const ivec2 coords, const int b)  { return imageLoad (image_hit_buffer_head, ivec3(coords, PEEL_HEAD_LAYER)).x; }

// set the incoming value as the head and the returned value as the next pointer
uint  exchangeHitBufferHead	(const ivec2 coords, const uint val	) { return imageAtomicExchange	(image_hit_buffer_head, ivec3(coords, PEEL_HEAD_LAYER), val); }

// store and load the texture holding the transport operators-probabilities used for path tracing
void storeOperatorsProbabilities	(const vec4 value)	{ imageStore (image_operators_probabilities, ivec3(gl_FragCoord.xy, OPERATORS_LAYER), value); }
vec4 loadOperatorsProbabilities		(				 )	{ return imageLoad (image_operators_probabilities, ivec3(gl_FragCoord.xy, OPERATORS_LAYER));}

// debug ray routines
#define __RAY_PREVIEW__
#ifdef RAY_PREVIEW_ENABLED
#define TRACE_HIZ_DEBUG
#define RAY_OFFSET_LAYER 4
void storeRay	(ivec3 coords, const vec4 value)	{ imageStore (image_operators_probabilities, ivec3(coords.xy, coords.z + RAY_OFFSET_LAYER), value); }
vec4 loadRay    (ivec3 coords     			 )		{ return imageLoad (image_operators_probabilities, ivec3(coords.xy, coords.z + RAY_OFFSET_LAYER));}
ivec2 debug_buffer_size;
bool isDebugFragment()								{ return (ivec2(gl_FragCoord.xy) == ivec2(debug_buffer_size.xy*0.5)); }
#endif // RAY_PREVIEW
#define __TEST_RAYS__
// TEST_DIFFUSE_RAYS
// TEST_VISIBILITY_RAYS
// TEST_GLOSSY_RAYS
// TEST_REFLECTION_RAYS

#ifdef STATISTICS
void storeStatistics (ivec2 coords, const vec4 value)	{ imageStore (image_operators_probabilities, ivec3(coords.xy, STATISTICS_LAYER), value); }
vec4 loadStatistics (ivec2 coords     			 )		{ return imageLoad (image_operators_probabilities, ivec3(coords.xy, STATISTICS_LAYER));}
#endif // STATISTICS

#define NUM_CUBEMAPS __NUM_FACES__
#define RAY_EPSILON __RAY_EPSILON__
#define MAX_FACE_LAYERS NUM_CUBEMAPS
#ifndef TEST_SHADOW_RAYS
#define UNLIMITED_RAY_DISTANCE
#else
float distance_to_light = 100000.0;
#endif

uniform mat4 uniform_view[NUM_CUBEMAPS];									// world->eye transformation for all views 
uniform mat4 uniform_view_inverse[NUM_CUBEMAPS];							// eye->world transformation for all views 
uniform mat4 uniform_proj[NUM_CUBEMAPS];									// eye->projection transformation for all views 
uniform mat4 uniform_proj_inverse[NUM_CUBEMAPS];							// eye->pixel transformation for all views 
uniform mat4 uniform_pixel_proj[NUM_CUBEMAPS];								// near far clipping distance for all views
uniform mat4 uniform_view_pixel_proj[NUM_CUBEMAPS];							// object->eye transformation for all views 
uniform vec2 uniform_near_far[NUM_CUBEMAPS];								// near far clipping distance for all views
uniform vec3 uniform_clip_info[NUM_CUBEMAPS];								// projection variables to convert eyeZ -> projZ
uniform vec2 uniform_viewports[NUM_CUBEMAPS];								// object->eye transformation for all views 
uniform float uniform_scene_length;											// the diagonal length of the scene's bounding box
uniform float uniform_progressive_sample;									// current sample for progressive rendering
uniform float uniform_time;													// time variable
uniform int uniform_bounce;													// path iteration
uniform int uniform_ab_mipmap;												// the minimum lod of the id buffer and the depth texture (e.g., for block size 1 lod=0, block size 2 lod = 1, etc.)
uniform int uniform_depth_mipmap;											// the maximum lod of the depth texture (used during HiZ)
uniform mat4 uniform_view_pixel_proj_low_res[NUM_CUBEMAPS];					// world->pixel transformation for all views in the shading resolution (since the id buffer can be downscaled)

vec3 ray_origin_wcs;														// the ray origin
vec3 ray_dir_wcs;															// the ray direction
vec2 out_hit_barycentric;													// the intersection's barycentric coordinates which will be stored in the hit record
vec3 out_hit_wcs;															// the intersection location which will be used to find the storage location of the hit 
uint out_primitive_id;														// the intersection's primitive id which will be stored in the hit record

bool vtransmission = false;
bool visibility = false;
// createHitRecord - creates the hit record data
// First, since the resolution of the id buffer could be lower, a projection operation transforms the intersection location to the corresponding pixel.
// Then, a new node is inserted at that location of the hit buffer. This way, we can perform a rasterization step (the Fetch pass) and fetch the data required.
// Parameters
// - cubeindex, the face at which the intersection occured
// The hit record data containing the barycentric coordinates, the primitive id and the intersection position 
// are stored in the global variables out_hit_barycentric, out_primitive_id, out_hit_wcs respectively
// The global variables used are:
// out_hit_wcs, containing the intersection location in world space
void createHitRecord(int cubeindex)
{
	if (visibility) return;
	// convert hit_coords to high res
	vec4 hit_pixel_high_res = uniform_view_pixel_proj[cubeindex] * vec4(out_hit_wcs, 1);
	hit_pixel_high_res.xy /= hit_pixel_high_res.w;

	// starts counting from 1, head points to zero
	uint peel_index = atomicCounterIncrement(next_address) + 1U;
	nodes_peel[peel_index].next = exchangeHitBufferHead(ivec2(hit_pixel_high_res.xy), peel_index);

	// for the low res version, the hit_coords should contain the high res coordinates
	uint prid_cube_mask = pack_prim_id_cubeindex(out_primitive_id, cubeindex);
	nodes_peel[peel_index].primitive_id = prid_cube_mask;
	nodes_peel[peel_index].owner = ivec2(gl_FragCoord.xy);

	nodes_peel[peel_index].extra_data = vec4(0.0, vtransmission == false ? 0.0 : 1.0, out_hit_barycentric);
}

// basic lib for transformations and RNG
#include "DIRT/DIRT_basic_lib.glsl"
// vertex creation
#include "DIRT/DIRT_vertex.glsl"
// per pixel abuffer tracing
#include "DIRT/DIRT_abuffer_cubemap.glsl"
// line tracing
#include "DIRT/DIRT_tracing.glsl"
// lighting and sampling calculations
#include "DIRT/DIRT_lighting.glsl"

void main(void)
{	
#ifdef RAY_PREVIEW_ENABLED
	debug_buffer_size = imageSize(image_operators_probabilities).xy;
#endif
	vec4 current_vertex_coords = vec4(0);
			
	uvec2 dimensions = uvec2(uniform_viewports[0]);
	uvec2 frag = uvec2(floor(gl_FragCoord.xy));

	// each 3-point pair is stored sequentially
	uint resolve_index = uint(frag.y * dimensions.x + frag.x) * 3u;
	bool isEmpty = 	nodes_shading[resolve_index + 2u].position.w < 0;
	// if there is no tracing to do
	if(isEmpty)
	{
		nodes_shading[resolve_index].position.w			= -1;
		nodes_shading[resolve_index + 1u].position.w	= -1;
		nodes_shading[resolve_index + 2u].position.w	= -1;
		storeOperatorsProbabilities(vec4(-1));
		return;
	}

	vec2 pixel_antialiasing_offset = vec2(0);
	if (uniform_bounce == 1)
	{		
#ifdef PIXEL_ANTIALIASING
		vec2 seed = TexCoord.xy * 17 * (uniform_progressive_sample * 0.1);	
		pixel_antialiasing_offset = rand2n(seed) - 0.5;
		current_vertex_coords.xy = gl_FragCoord.xy + pixel_antialiasing_offset;
#else
		current_vertex_coords.xy = gl_FragCoord.xy;
#endif // PIXEL_ANTIALIASING
	}
	

	if (uniform_bounce == 1)
	{
		// for direct lighting no trace is needed since we use the optional Direct Visibility pass

		// this is not used in the first pass
		nodes_shading[resolve_index].position = vec4(0);

		// this is the camera
		nodes_shading[resolve_index + 1].position = vec4(0);
		
		// zw (depth, face) have already been set in the peel_depth step
		vec2 dim_step = vec2(1.0) / imageSize(image_hit_buffer_head).xy;
		Vertex current_vertex = createVertex(resolve_index + 2u);
		nodes_shading[resolve_index + 2].position.xy = current_vertex.position.xy;

		storeOperatorsProbabilities(vec4(1));
		return;
	}
	
	// reconstruct the previous position
	// TODO: the first indirect bounce position for DoF should not be zero
	vec3 prev_vertex_position_ecs	= getVertexPosition(resolve_index);

	Vertex current_vertex = createVertex(resolve_index + 1u);
#if NUM_CUBEMAPS > 1
#ifdef SKIP_FIRST_FACE
if (current_vertex.face == 0)
	current_vertex.face = 1;
#endif
#endif
	float current_vertex_to_next_inverse_probability = 1.0;

	bool transmission = false;
	ivec4 new_vertex_coords = ivec4(0);

	// default BSDF sampling for all rays of for TEST_GLOSSY_RAYS
	// generate a new sampling direction based on the fragments's BSDF properties
	// and retrieve the probability as well
#if !defined (TEST_DIFFUSE_RAYS) && !defined (TEST_VISIBILITY_RAYS) && !defined (TEST_REFLECTION_RAYS)
	vec3 current_vertex_sample_dir = getNewSamplePositionNDFSampling(current_vertex_to_next_inverse_probability, prev_vertex_position_ecs, current_vertex, uniform_bounce-1, transmission);
#endif // TEST_DIFFUSE_RAYS

	// sampling for TEST_REFLECTION_RAYS
#ifdef TEST_REFLECTION_RAYS
		current_vertex_to_next_inverse_probability = 1.0;
		vec3 I = normalize(current_vertex.position - prev_vertex_position_ecs);
		vec3 current_vertex_sample_dir = reflect(I, current_vertex.normal);
#endif // TEST_REFLECTION_RAYS

	// sampling for TEST_VISIBILITY_RAYS
#ifdef TEST_VISIBILITY_RAYS
		current_vertex_to_next_inverse_probability = 1.0;
		vec3 current_vertex_sample_dir = normalize(vec3(100000,100000,100000) - current_vertex.position);
#endif//  TEST_VISIBILITY_RAYS

	// cosine sampling for TEST_DIFFUSE_RAYS
#ifdef TEST_DIFFUSE_RAYS
		vec2 seed = getSamplingSeed(uniform_bounce-1);
		vec3 r = rand3n(seed);
		vec3 current_vertex_sample_dir = getNewSamplePositionCosineHemisphereSampling(current_vertex_to_next_inverse_probability, current_vertex, r.x * 2.0 * pi, uniform_bounce-1);
#endif // TEST_DIFFUSE_RAYS
	
	vtransmission = transmission;
	int result = invalid_result;
	start_primitive_id = current_vertex.prim_id;
	out_hit_barycentric = vec2(0);
	out_hit_wcs = vec3(0);
	ray_origin_wcs = PointECS2WCS(current_vertex.position, 0);
	ray_dir_wcs = normalize(VectorECS2WCS(current_vertex_sample_dir, 0));
	// trace the scene and find a new vertex position
	// if there is a hit, the hit record is created
	bool has_hit = traceScreenSpaceRay_abuffer(current_vertex.position, current_vertex_sample_dir, current_vertex.face);
		
#ifdef TEST_VISIBILITY_RAYS
	return;		
#endif//  TEST_VISIBILITY_RAYS

	if (!has_hit)
		nodes_shading[resolve_index + 2].position = vec4(current_vertex.position + current_vertex_sample_dir * 10000.0, -1);

	// store the inverse probability of the current sample
	vec4 operators_probabilities = loadOperatorsProbabilities();
	storeOperatorsProbabilities(vec4(operators_probabilities.rgb, operators_probabilities.w * current_vertex_to_next_inverse_probability));
}
