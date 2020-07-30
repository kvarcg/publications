// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation of Ambient Occlusion
// which performs ray tracing in screen-space, either linearly or hierarchically 
// through the single- or multi-view structure

#include "version.h"
#include "MMRT/MMRT_data_structs.glsl"
#include "trace_define.h"

in vec2 TexCoord;		// uv coordinates

#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#define NUM_MEMORY_CUBEMAPS		__NUM_FACES__

layout(binding = 0, rgba32f)	coherent	uniform image2D			image_result;			// stores the final result

// image bindings
layout(binding = 3, r32ui )	readonly uniform uimage2DArray  image_head_tail;				// stored head pointers per view and per bucket and then tail pointers in the same manner
layout(binding = 4, std430)	readonly buffer  LL_DATA	 { NodeTypeData			data []; };	// the Data buffer
layout(binding = 5, std430)	readonly buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; }; // the ID buffer
layout(binding = 11) uniform sampler2DArray tex_depth_bounds;								// the depth bounds
	
uint  getPixelHeadID	(const ivec3 coords)	{ return imageLoad (image_head_tail, ivec3(coords)).r;} // retrieve the head ID for a bucket
uint  getPixelTailID	(const ivec3 coords)	{ return imageLoad (image_head_tail, ivec3(coords.xy, coords.z + BUCKET_SIZE*NUM_MEMORY_CUBEMAPS)).r;} // retrieve the tail ID for a bucket

#define __HIZ_MARCHING_ENABLED__
#define __RAY_PREVIEW__
#ifdef RAY_PREVIEW_ENABLED
#ifdef HIZ_MARCHING
#define TRACE_HIZ_DEBUG
#endif // HIZ_MARCHING
layout(binding = 1, rgba32f)	coherent	uniform image2DArray	image_ray_positions;
#define RAY_OFFSET_LAYER 1
void storeRay	(ivec3 coords, const vec4 value)	{ imageStore (image_ray_positions, ivec3(coords.xy, coords.z + RAY_OFFSET_LAYER), value); }
vec4 loadRay    (ivec3 coords     			 )		{ return imageLoad (image_ray_positions, ivec3(coords.xy, coords.z + RAY_OFFSET_LAYER));}
ivec2 debug_buffer_size;
bool isDebugFragment()								{ return (ivec2(gl_FragCoord.xy) == ivec2(debug_buffer_size.xy*0.5)); }
#endif // RAY_PREVIEW

#ifdef STATISTICS
layout(binding = 2, rgba32f)	coherent	uniform image2D			image_ray_test_data;
#endif // STATISTICS

#define SAMPLES_PER_PIXEL __SAMPLES_PER_PIXEL__
#define NUM_CUBEMAPS __NUM_FACES__
// if RAY_DISTANCE is defined as less or equal than 0 then UNLIMITED_RAY_DISTANCE is defined externally
#define RAY_DISTANCE __RAY_DISTANCE__
#define __UNLIMITED_RAY_DISTANCE__
#define RAY_EPSILON __RAY_EPSILON__
#define __SINGLE_LAYER__
#define __FRAGMENT_VISUALIZATION__
//#define LAMBERT_ONLY

#define MAX_FACE_LAYERS NUM_CUBEMAPS
#ifdef LAYER_VISUALIZATION
#undef FACE_VISUALIZATION
#undef NUM_CUBEMAPS
//#undef RAY_DISTANCE
#define NUM_CUBEMAPS 1
#define UNLIMITED_RAY_DISTANCE
//#undef EARLY_SKIP
//#define SINGLE_LAYER
#endif

uniform mat4 uniform_view[NUM_CUBEMAPS];					// background color
uniform mat4 uniform_view_inverse[NUM_CUBEMAPS];			// world->view transformation for all views 
uniform mat4 uniform_proj[NUM_CUBEMAPS];					// view->world transformation for all views 
uniform mat4 uniform_proj_inverse[NUM_CUBEMAPS];			// view->projection transformation for all views 
uniform mat4 uniform_pixel_proj[NUM_CUBEMAPS];				// projection->view transformation for all views 
uniform mat4 uniform_pixel_proj_inverse[NUM_CUBEMAPS];		// view->pixel transformation for all views 
uniform float uniform_scene_length;							// pixel->view transformation for all views 
uniform vec2 uniform_near_far[NUM_CUBEMAPS];				// the scene's diagonal
uniform vec3 uniform_clip_info[NUM_CUBEMAPS];				// near far clipping distance for all views
uniform vec2 uniform_viewports[NUM_CUBEMAPS];				// projection variables to convert eyeZ -> projZ
uniform ivec4 uniform_viewport_edges[NUM_CUBEMAPS];			// object->eye transformation for all views 
uniform float uniform_progressive_sample;					// viewport edges
uniform float uniform_time;									// time variable
uniform int uniform_blend;									// current sample for progressive rendering
uniform int uniform_lod_max;								// blend coefficients for iterative/progressive rendering
															// the maximum lod of the depth texture (used during HiZ)
// basic lib for transformations and RNG
#include "MMRT/MMRT_basic_lib.glsl"
// vertex creation
#include "MMRT/MMRT_vertex.glsl"
#ifdef HIZ_MARCHING
// per pixel abuffer tracing
#include "MMRT/MMRT_abuffer_cubemap_hiz.glsl"
// view tracing
#include "MMRT/MMRT_tracing_hiz.glsl"
#else
// per pixel abuffer tracing
#include "MMRT/MMRT_abuffer_cubemap_linear.glsl"
// view tracing
#include "MMRT/MMRT_tracing_linear.glsl"
#endif // HIZ_MARCHING
// lighting and sampling calculations
#include "MMRT/MMRT_lighting.glsl"

bool isSkyBox(float emission)
{
	// HACK: large emission is the sky
	return (emission > 990.0);
}

// adds the color for each path
// Parameters:
// - final_color, the final color of the current path
void store_color(vec3 final_color)
{
	// iterative
	vec4 stored_color = vec4(0.0);
	float total_samples = 1;
	if (uniform_blend == 1)
	{
    	stored_color = imageLoad(image_result, ivec2(gl_FragCoord.xy));
		total_samples += stored_color.a;
	}
	final_color.xyz = final_color.xyz + stored_color.xyz * stored_color.a;
	final_color.xyz /= (total_samples);
	
	imageStore(image_result, ivec2(gl_FragCoord.xy), vec4(final_color.xyz, total_samples));
}

void main(void)
{
	vec2 current_vertex_coords = gl_FragCoord.xy;

	// if no fragments, return
	bool isEmpty = isABufferEmpty(ivec2(current_vertex_coords.xy));
	if(isEmpty)
	{
		store_color(vec3(1));
		return;
	}
		
#ifdef RAY_PREVIEW_ENABLED
	debug_buffer_size = imageSize(image_result).xy;
#endif

	vec4 final_color = vec4(0,0,0,1);
	vec2 hitPixel = vec2(-2.0, -2.0);
	int	 layer = 0;	
	int result = ABUFFER_FACE_NO_HIT_EXIT;
	bool has_hit = false;

	// slightly offset the starting ray position to perform antialiasing at no extra cost during progressive rendering
#ifdef PIXEL_ANTIALIASING
		vec2 seed = TexCoord.xy * 17 * (uniform_progressive_sample * 0.1);	
		vec2 pixel_antialiasing_offset = rand2n(seed) - 0.5;
		current_vertex_coords.xy = gl_FragCoord.xy + pixel_antialiasing_offset;
#endif // PIXEL_ANTIALIASING

	uint current_vertex_coords_id = getPixelHeadID(ivec3(gl_FragCoord.xy, 0));

	// the current position
	Vertex current_vertex						= createVertex(current_vertex_coords, current_vertex_coords_id, 0
#ifdef LAYER_VISUALIZATION
	, 0
#endif // LAYER_VISUALIZATION
);
#if NUM_CUBEMAPS > 1
current_vertex.face = 0;
#endif

	// HACK: large emission is the sky
	if (isSkyBox(current_vertex.color.a))
	{
		store_color(vec3(1));
		return;
	}
	Vertex new_vertex;
	
	// the camera
	vec3 prev_vertex_position_ecs = vec3(0);
	vec3 current_vertex_sample_dir = vec3(0);
	float		start_occlusion = 0.0;
	float		total_occlusion = 0.0;
	vec3		bent_normal = vec3(0);
	vec3	occ_color = vec3(0);
	for (int i = 0; i < SAMPLES_PER_PIXEL; i++)
	{
		// trace to find a new vertex	
		vec2 seed = getSamplingSeed(i);
		float r = rand1n(seed);
		float out_inv_pdf = 1.0;
		// generate a new sampling position
		current_vertex_sample_dir = getNewSamplePositionUniformHemisphereSampling(out_inv_pdf, current_vertex, i+1, 1);
		
		// trace the scene and find a new vertex position
		// if there is a hit, the returned vertex is created
		vec3 pos = current_vertex.position;// + current_vertex_sample_dir * 0.0001;
		float jitter = r * 0.5 + 0.5;
		has_hit = traceScreenSpaceRay_abuffer(pos, current_vertex_sample_dir, jitter, current_vertex.face, result, new_vertex);
		bool hitSkybox = isSkyBox(new_vertex.color.a);

		float result = max(0.0, dot(current_vertex_sample_dir, current_vertex.normal));
		start_occlusion += (has_hit && !hitSkybox)? 0.0: result * out_inv_pdf;
				
#if defined (FACE_VISUALIZATION)
		if (has_hit)
		{
			vec3 heatmap_hsl = vec3(0.0, 1.0, 1.0);
			float counter_norm = clamp(new_vertex.face / 6.0, 0.0, 1.0);
			heatmap_hsl.r = mix(240, 0, counter_norm);
			final_color.xyz += hsv2rgb(heatmap_hsl);
		}
#elif defined (LAYER_VISUALIZATION)
		if (has_hit)
		{
			vec3 heatmap_hsl = vec3(0.0, 1.0, 1.0);
			float counter_norm = clamp(new_vertex.depth_layer / 4.0, 0.0, 1.0);
			heatmap_hsl.r = mix(240, 0, counter_norm);
			final_color.xyz += hsv2rgb(heatmap_hsl);
		}
#endif // FACE_VISUALIZATION || LAYER_VISUALIZATION
	}

	total_occlusion = start_occlusion / float(SAMPLES_PER_PIXEL);	
	vec3 total_color = occ_color / vec3(SAMPLES_PER_PIXEL);
#if !defined (FACE_VISUALIZATION) && !defined (LAYER_VISUALIZATION)
	final_color.xyz = vec3(pow(total_occlusion * total_occlusion , 0.45));
#endif // FACE_VISUALIZATION && LAYER_VISUALIZATION
	
	store_color(final_color.xyz);
}