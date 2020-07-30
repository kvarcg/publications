// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Shade pass
// The shading buffer contents G[k-1], G[k], G[k+1] are fetched to compute the final illumination for the current path segment

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

#define __RSM__VISIBILITY__
#define SHADING_STAGE
#define __TEST_RAYS__
#define TEST_SHADOW_RAYS
//#ifdef TEST_DIFFUSE_RAYS
//#define LAMBERT_ONLY
//#endif

#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#define NUM_MEMORY_CUBEMAPS		__NUM_FACES__

// stores the cumulative operators and probabilities
// layer 1 stores debug text data and layer 2 stores debug color data
layout(binding = 0, rgba32f)	coherent	uniform image2DArray	image_operators;			// the transport operators texture

// image bindings
layout(binding = 1, r32ui )		writeonly uniform uimage2DArray  image_hit_buffer_head;			// the hit buffer head id texture
layout(binding = 2, std430)		coherent buffer  LLD_SHADING	 { NodeTypeShading		nodes_shading []; };		// the shading buffer
layout(binding = 4, std430)		writeonly buffer  LLD_HIT		 { NodeTypeHit			nodes_peel[]; };			// the hit buffer
layout(binding = 7, rgba32f)	coherent	uniform image2DArray	image_result;				// the final illumination texture

// these are used for raytraced visibility tests (a very efficient alternative is to use the shadow maps)
layout(binding = 3, std430)		coherent buffer  LLD_ID			 { NodeTypeTrace		nodes[]; };					// the id buffer
layout(binding = 5, std430)		coherent buffer  LLD_PRIMITIVE	 { NodeTypePrimitive	nodes_primitives[]; };		// the primitive buffer
layout(binding = 11) uniform sampler2DArray  tex_depth_bounds;														// the depth bounds texture, used for HiZ
layout(binding = 12) uniform usampler2DArray tex_head_id_buffer;													// the id buffer head id texture

#define PEEL_HEAD_LAYER_OFFSET 1
// gets the id buffer head for the current pixel
uint  getPixelHeadidBuffer	(const ivec2 coords, const int b) { return	texelFetch(tex_head_id_buffer	, ivec3(coords, PEEL_HEAD_LAYER_OFFSET + b), 0).x; }

#define PEEL_HEAD_LAYER 0
// sets the id buffer head for the current pixel
void  setPeelHeadID			(const ivec2 coords, const uint val	) { imageStore	(image_hit_buffer_head, ivec3(coords, PEEL_HEAD_LAYER), uvec4(val, 0u, 0u, 0u)); }

#define OPERATORS_LAYER 0
// store and load the texture holding the transport operators-probabilities used for path tracing
void storeOperatorsProbabilities	(const vec4 value)	{ imageStore (image_operators, ivec3(gl_FragCoord.xy, OPERATORS_LAYER), value); }
vec4 loadOperatorsProbabilities		(				 )	{ return imageLoad (image_operators, ivec3(gl_FragCoord.xy, OPERATORS_LAYER));}

#define invalid_result -1

#define NUM_CUBEMAPS __NUM_FACES__
#define MAX_FACE_LAYERS NUM_CUBEMAPS

uniform mat4 uniform_view[NUM_CUBEMAPS];								// world->view transformation for all views 
uniform mat4 uniform_view_inverse[NUM_CUBEMAPS];						// view->world transformation for all views 
uniform mat4 uniform_proj[NUM_CUBEMAPS];								// view->projection transformation for all views 
uniform mat4 uniform_proj_inverse[NUM_CUBEMAPS];						// projection->view transformation for all views 
uniform mat4 uniform_pixel_proj[NUM_CUBEMAPS];							// view->pixel transformation for all views 
uniform mat4 uniform_pixel_proj_inverse[NUM_CUBEMAPS];					// pixel->view transformation for all views 
uniform mat4 uniform_view_pixel_proj[NUM_CUBEMAPS];						// world->projection transformation for all views 
uniform float uniform_scene_length;										// the scene's diagonal
uniform vec2 uniform_near_far[NUM_CUBEMAPS];							// near far clipping distance for all views
uniform vec3 uniform_clip_info[NUM_CUBEMAPS];							// projection variables to convert eyeZ -> projZ
uniform vec2 uniform_viewports[NUM_CUBEMAPS];							// object->eye transformation for all views 
uniform ivec4 uniform_viewport_edges[NUM_CUBEMAPS];						// viewport edges
uniform float uniform_progressive_sample;								// current sample for progressive rendering
uniform float uniform_time;												// time variable
uniform ivec2 uniform_blend;											// blend coefficients for iterative/progressive rendering
uniform int uniform_bounce;												// path iteration
uniform int uniform_ab_mipmap;											// the minimum lod of the id buffer and the depth texture
uniform int uniform_depth_mipmap;										// the maximum lod of the depth texture (used during HiZ)

uniform vec3 uniform_background_color;									// background color

uniform mat4 uniform_light_view;										// spotlight information for illumination calculations
uniform mat4 uniform_light_projection;									// and shadow mapping (if enabled instead of analytic visibility tests)
uniform mat4 uniform_light_projection_inverse;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_position;
uniform vec3 uniform_light_direction;
uniform int uniform_light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_light_spotlight_exponent;
uniform float uniform_light_size;
uniform float uniform_light_shadow_map_resolution;
uniform bool uniform_light_shadows_enabled;
uniform float uniform_light_constant_bias;
uniform vec2 uniform_light_pcf_samples[16];
uniform sampler2D sampler_rsm_depth;

in vec2 TexCoord;

vec3 ray_dir_wcs;														// global values
vec3 ray_origin_wcs;
vec2 out_hit_barycentric;
vec3 out_hit_wcs;
uint out_primitive_id;
float distance_to_light = 100000;

// basic lib for transformations and RNG
#include "DIRT/DIRT_basic_lib.glsl"
// vertex creation
#include "DIRT/DIRT_vertex.glsl"
// lighting and sampling calculations
#include "DIRT/DIRT_lighting.glsl"
#if !defined (RSM_VISIBILITY)
// per pixel abuffer tracing
#include "DIRT/DIRT_abuffer_cubemap.glsl"
// line tracing
#include "DIRT/DIRT_tracing.glsl"
#endif // RSM_VISIBILITY

// adds the color for each path
// Parameters:
// - final_color, the color for the current path event
void store_color(vec3 final_color)
{
	// iterative
	if (uniform_blend.x == 0)
	{	
		vec4 stored_path_color = imageLoad(image_result, ivec3(gl_FragCoord.xy, 1));
		stored_path_color.xyz += final_color.xyz;
		imageStore(image_result, ivec3(gl_FragCoord.xy, 1), vec4(stored_path_color.xyz, 1));
	}
	else if (uniform_blend.x == 1)
	{	
		vec4 stored_total_color = vec4(0);
		if (uniform_blend.y == 0)
			stored_total_color  = imageLoad(image_result, ivec3(gl_FragCoord.xy, 0));

		vec4 stored_path_color = imageLoad(image_result, ivec3(gl_FragCoord.xy, 1));
		vec3 new_path_color = stored_path_color.rgb + final_color;

		// add the averaged stored color with the calculated path color
		vec3 c = stored_total_color.xyz * stored_total_color.a + new_path_color.rgb;
		stored_total_color.a += 1;
		c /= stored_total_color.a;
		imageStore(image_result, ivec3(gl_FragCoord.xy, 0), vec4(c, stored_total_color.a));
		imageStore(image_result, ivec3(gl_FragCoord.xy, 1), vec4(0));
	}

	// CORRECT
	//vec4 stored_total_color = vec4(0);
	//stored_total_color  = imageLoad(image_result, ivec3(gl_FragCoord.xy, 0));
	//imageStore(image_result, ivec3(gl_FragCoord.xy, 0), vec4(final_color + stored_total_color.xyz, stored_total_color.a));
}

void main(void)
{
	uvec2 dimensions = uvec2(uniform_viewports[0]);

	uvec2 frag = uvec2(floor(gl_FragCoord.xy));
	// each 3-point pair is stored sequentially
	int resolve_index = int(frag.y * dimensions.x + frag.x) * 3;

#ifdef NO_PACKING
	bool isEmpty = nodes_shading[resolve_index + 2u].extra.x == -1.0;
#else
	bool isEmpty = nodes_shading[resolve_index + 2u].ior_opacity == 0u;
#endif // NO_PACKING	

	// if no fragments, return
	vec3 background_color = uniform_bounce == 1 ? uniform_background_color.rgb : vec3(0);
	if (isEmpty)
	{
		store_color(background_color.rgb);
		return;
	}
		
	#ifdef NO_PACKING
		bool isMissing = nodes_shading[resolve_index + 2u].extra.x != 2.0;
	#else
		bool isMissing = unpackUnorm4x8(nodes_shading[resolve_index + 2u].specular).w != 2.0;
	#endif // NO_PACKING	

	vec3 prev_vertex_position_ecs = vec3(0);
	Vertex current_vertex;
	Vertex next_vertex;
	bool has_hit = true;
	// direct pass
	if (uniform_bounce == 1)
	{
		// for DoF the position should be different
		current_vertex.position			= vec3(0);

		// the new vertex
		next_vertex						= createVertex(resolve_index + 2u);
		#if NUM_CUBEMAPS > 1
#ifdef SKIP_FIRST_FACE
if (next_vertex.face == 0) next_vertex.face = 1;
#endif
#endif
	}
	else
	{
#ifdef TEST_MISSING_PEEL_DATA
			if (isMissing)
				{
				store_color(vec3(1,0,0));
				}
			else
				store_color(vec3(0,1,0));
			return;
#endif // TEST_MISSING_PEEL_DATA

		// if there is no hit, just complete the path
		if (nodes_shading[resolve_index + 2u].position.w < 0)
		{
			has_hit = false;

#ifdef TEST_INTERSECTIONS
			store_color(vec3(1,1,0));
			return;
#endif
		}

		if (uniform_bounce > 2)
		{
			prev_vertex_position_ecs = getVertexPosition(resolve_index);
		}

		// the current vertex
		current_vertex					= createVertex(resolve_index + 1u);

		// the new vertex
		next_vertex						= createVertex(resolve_index + 2u);
#if NUM_CUBEMAPS > 1
#ifdef SKIP_FIRST_FACE
if (current_vertex.face == 0) current_vertex.face = 1;
if (next_vertex.face == 0) next_vertex.face = 1;
#endif
#endif
	}

#ifdef TEST_VISIBILITY_RAYS
	if (uniform_bounce > 1)
	{
		store_color(vec3(0).xyz);
		return;
	}
#endif

	vec3 light_color_intensity = uniform_light_color;
	vec3 light_position_ecs = uniform_light_position;
	vec3 light_dir_ecs = uniform_light_direction;

	vec3 path_color = vec3(0);
	vec4 operators_probabilities = loadOperatorsProbabilities();
	
	setPeelHeadID(ivec2(gl_FragCoord.xy), 0u);
 	if (!has_hit && uniform_bounce > 1)
	{	
#if NUM_CUBEMAPS > 1
		vec3 current_vertex_to_background_direction_ecs = next_vertex.position.xyz;
		vec3 current_vertex_to_prev_direction_ecs		= prev_vertex_position_ecs - current_vertex.position;
		float current_vertex_to_background_dist2		= dot(current_vertex_to_background_direction_ecs, current_vertex_to_background_direction_ecs);
		current_vertex_to_background_direction_ecs		= normalize(current_vertex_to_background_direction_ecs);
		current_vertex_to_prev_direction_ecs			= normalize(current_vertex_to_prev_direction_ecs);
#ifdef LAMBERT_ONLY		
		vec3 current_vertex_to_background_brdf			= Lambert_BRDF(current_vertex); 
#else
		vec3 current_vertex_to_background_brdf			= Microfacet_Lambert_BSDF(current_vertex_to_background_direction_ecs.xyz, current_vertex_to_prev_direction_ecs.xyz, current_vertex);
#endif // LAMBERT_ONLY
		float current_vertex_to_background_geom			= getGeometricTermPointLightSource(current_vertex_to_background_direction_ecs, current_vertex);
		current_vertex_to_background_geom = (dot(current_vertex.normal, current_vertex_to_background_direction_ecs) < 0.0) ? 0.0 : current_vertex_to_background_geom;
		vec3 current_vertex_to_background_transport_operator = current_vertex_to_background_brdf * current_vertex_to_background_geom;
		path_color.xyz = operators_probabilities.rgb * current_vertex_to_background_transport_operator * uniform_background_color;		
		store_color(path_color.xyz);	
#else
		store_color(vec3(0));
#endif	// NUM_FACES
		nodes_shading[resolve_index + 2u].position = vec4(0,0,0,-1);
		return;
	}

	float current_vertex_geom = 0;
	vec3 current_vertex_brdf;
	vec3 current_vertex_to_next_transport_operator = vec3(1);
	// connect vertices for indirect paths
	if (uniform_bounce > 1)
	{
		// connect current vertex to new vertex and get transport operator
		vec3 current_vertex_to_next_direction_ecs	= next_vertex.position - current_vertex.position;
		vec3 current_vertex_to_prev_direction_ecs	= prev_vertex_position_ecs - current_vertex.position;
		current_vertex_to_next_direction_ecs		= normalize(current_vertex_to_next_direction_ecs);
		current_vertex_to_prev_direction_ecs		= normalize(current_vertex_to_prev_direction_ecs);
		
#ifdef LAMBERT_ONLY
		current_vertex_brdf					= Lambert_BRDF(current_vertex);
#else
		current_vertex_brdf					= Microfacet_Lambert_BSDF(current_vertex_to_next_direction_ecs.xyz, current_vertex_to_prev_direction_ecs.xyz, current_vertex);
#endif // LAMBERT_ONLY
		current_vertex_geom					= getGeometricTerm(current_vertex_to_next_direction_ecs, current_vertex, next_vertex);

		current_vertex_to_next_transport_operator = current_vertex_brdf * current_vertex_geom;

		// multiply the current set of transport operators with the new
		operators_probabilities.rgb					*= current_vertex_to_next_transport_operator;
	}
	// connect new vertex to light (for direct lighting next event estimation) and get transport operator	
	float inv_pdf_light = 1.0;
#ifdef RSM_VISIBILITY
	vec3 next_vertex_light_position_ecs		= light_position_ecs;			
	vec3 next_vertex_to_light_direction_ecs	= next_vertex_light_position_ecs - next_vertex.position;
	float next_vertex_to_light_dist2		= dot(next_vertex_to_light_direction_ecs, next_vertex_to_light_direction_ecs);
	next_vertex_to_light_direction_ecs		= normalize(next_vertex_to_light_direction_ecs);
	float spoteffect = check_spotlight(next_vertex_to_light_direction_ecs);	
	float in_shadow = 1;
	if (dot(next_vertex_to_light_direction_ecs, next_vertex.normal) > 0 && next_vertex_to_light_dist2 > 0.0)
		in_shadow = shadow(next_vertex.position) * spoteffect;
#else
	vec3 pos_wcs = PointECS2WCS(uniform_light_position, 0);

	// light position is adjusted externally to produce similar results to the RSMs
	float light_size = 0.0;
	vec3 pos = pos_wcs;// + light_size * getNewSamplePositionUniformSphereSampling(inv_pdf_light, uniform_bounce-1);
	pos = PointWCS2ECS(pos, 0);
	start_primitive_id = next_vertex.prim_id;
	vec3 light_sample_dir = normalize(pos - next_vertex.position);
	float remaining_distance = length(pos - next_vertex.position);
	distance_to_light = remaining_distance;
	vec3 next_vertex_to_light_direction_ecs	= light_sample_dir;
	float next_vertex_to_light_dist2		= distance_to_light * distance_to_light;
	bool visibility_ray_hit = false;
	if (dot(light_sample_dir, next_vertex.normal) > 0 && next_vertex_to_light_dist2 > 0.0)
	{
		ray_origin_wcs = PointECS2WCS(next_vertex.position, 0);
		ray_dir_wcs = normalize(VectorECS2WCS(light_sample_dir, 0));
		visibility_ray_hit = traceScreenSpaceRay_abuffer(next_vertex.position, light_sample_dir, next_vertex.face, remaining_distance);
	}
	
	float spoteffect = check_spotlight(normalize(pos - next_vertex.position));
	float in_shadow = visibility_ray_hit == true ? 0.0 : spoteffect;		
#endif // RSM_VISIBILITY

	// if we didnt hit an object, we hit the light source
	if (in_shadow > 0.0)
	{
		vec3 next_vertex_to_prev_direction_ecs	= current_vertex.position - next_vertex.position;
		next_vertex_to_prev_direction_ecs		= normalize(next_vertex_to_prev_direction_ecs);
#ifdef LAMBERT_ONLY
		vec3 next_vertex_to_light_brdf			= Lambert_BRDF(next_vertex); 
#else
		vec3 next_vertex_to_light_brdf			= Microfacet_Lambert_BSDF(next_vertex_to_light_direction_ecs.xyz, next_vertex_to_prev_direction_ecs.xyz, next_vertex);
#endif // LAMBERT_ONLY
		float next_vertex_to_light_geom			= getGeometricTermPointLightSource(next_vertex_to_light_direction_ecs, next_vertex);
		vec3 next_vertex_to_light_transport_operator = next_vertex_to_light_brdf * next_vertex_to_light_geom;
		
		path_color								= next_vertex_to_light_transport_operator * light_color_intensity / next_vertex_to_light_dist2;
		path_color								*= operators_probabilities.rgb * operators_probabilities.a * inv_pdf_light * in_shadow;
	}
	// emission
	path_color.xyz	+= operators_probabilities.rgb * operators_probabilities.a * next_vertex.color.rgb * next_vertex.color.a;

	if (uniform_bounce > 1)
		path_color.xyz	*= ACCENUATE_GI;
	//operators_probabilities = vec4(operators_probabilities.a) / 10.0;
	operators_probabilities = vec4(operators_probabilities.rgb,1);
	storeOperatorsProbabilities(operators_probabilities);

	path_color.xyz = clamp(path_color.xyz, vec3(0), vec3(2));
	store_color(path_color.xyz);
	
	// Left shift the shading buffer
	// for any indirect bounces trace
	// change the stored current and next to previous and current
	nodes_shading[resolve_index]		= nodes_shading[resolve_index + 1u];
	nodes_shading[resolve_index + 1u]	= nodes_shading[resolve_index + 2u];

	// reset the next hit
	nodes_shading[resolve_index + 2u].position = vec4(0,0,0,0);
	
	setPeelHeadID(ivec2(gl_FragCoord.xy), 1u);

	// cull 
	//if (uniform_bounce > 1 && all(lessThan(current_vertex_to_next_transport_operator, vec3(0.01))))
	//{
	//	nodes_shading[resolve_index + 2u].position = vec4(0,0,0,-1);
	//	setPeelHeadID(ivec2(gl_FragCoord.xy), 0u);
	//}
}
