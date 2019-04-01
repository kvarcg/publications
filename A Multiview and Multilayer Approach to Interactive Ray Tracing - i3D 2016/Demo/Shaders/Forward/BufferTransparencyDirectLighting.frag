// Variable k-Buffer using Importance Maps (Short Eurographics 2017)
// https://diglib.eg.org/handle/10.2312/egsh20171005
// Authors: A.A. Vasilakis, K. Vardis, G. Papaioannou, K. Moustakas
// Fragment shader for the direct lighting calculations

#version 440 core
//layout(early_fragment_tests) in;
// Channels:
// 0: R,    G,    B,		1-Ke
// 1: Nx,   Ny
// 2: reflectance, gloss, metallic, unused 
// 3: v_x,  v_y,  Unused,   Unused
// 4: ItemID, Unused
//
//
layout(location = 0) out vec4 out_transparency;
in vec2 TexCoord;

#include "data_structs.h"

//uniform sampler2D sampler_lighting;
uniform sampler2D sampler_noise;
uniform sampler2D sampler_shadow_map;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_position;
uniform vec3 uniform_light_direction;
uniform int uniform_light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_spotlight_exponent;
uniform float uniform_light_size;
uniform float uniform_shadow_map_resolution;
uniform bool uniform_shadows_enabled;
uniform vec2 uniform_samples[16];
uniform float uniform_constant_bias;

uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_light_view;
uniform mat4 uniform_light_projection;
uniform mat4 uniform_light_projection_inverse;

#define KBUFFER_SIZE			__ABUFFER_LOCAL_SIZE__
#define KBUFFER_SIZE_1n			KBUFFER_SIZE - 1

#include "depth_reconstruction.h"
#include "normal_compression.h"
#include "spotlight.h"
#include "shadow_mapping.h"
#include "microfacet_direct_lighting.h"

vec3 calculateLighting(vec3 light_position_ecs, float depth, vec3 albedo, float fragment_opacity, vec3 normal, vec3 spec_coef, vec3 prev_color, float prev_alpha)
{	
	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, depth);
	if (dot(pecs, normal) > 0) normal = -normal;
	vec3 vertex_to_light_direction_ecs = light_position_ecs - pecs.xyz;
	float dist2 = dot(vertex_to_light_direction_ecs,vertex_to_light_direction_ecs);
	// normalize vertex to light direction vector
	vertex_to_light_direction_ecs = normalize(vertex_to_light_direction_ecs);
	// check spotlight cutoff between light-to-vertex and spotlight direction
	float spoteffect = check_spotlight(uniform_view, vertex_to_light_direction_ecs);
	vec3 vertex_to_view_direction = -normalize(pecs.xyz);
	vec3 T = vec3(1);
	vec3 dirColor = MicrofacetBRDFTr(vertex_to_view_direction.xyz, vertex_to_light_direction_ecs.xyz, normal.xyz, albedo.rgb, spec_coef.xyz, fragment_opacity, T) * uniform_light_color.rgb  * spoteffect/dist2;
	float shadowFactor = 1;
	if (uniform_shadows_enabled) shadowFactor = shadow(pecs);
	dirColor *= mix(vec3(0.0), vec3(1), shadowFactor);
		
	vec3 fragment_color = dirColor.rgb + albedo.rgb * T * (1-fragment_opacity) * prev_color.rgb;
	fragment_color.rgb = clamp(fragment_color.rgb, vec3(0), vec3(1));
	return fragment_color;
}

#define __KBUFFER_METHOD__
// KB_AB_SB
#if defined(KB_AB_SB)
layout(binding = 0, r32ui  ) readonly  uniform uimage2D		image_counter;
layout(binding = 1, r32ui  ) readonly  uniform uimage2D		image_head;
layout(binding = 2, std430 ) coherent buffer   SBUFFER	{ NodeTypeDataSB nodes []; };
layout(binding = 3, rgba32f) writeonly uniform image2D		image_prev;

uint getPixelHeadAddress	() {return imageLoad (image_head   , ivec2(gl_FragCoord.xy)).x;}
uint getPixelFragCounter	() {return imageLoad (image_counter, ivec2(gl_FragCoord.xy)).x;}

void main(void)
{
	vec4 final_color = vec4(0);//texture(sampler_lighting, TexCoord.st);

	int counter = int(getPixelFragCounter());
	if(counter == 0)
	{
		out_transparency = vec4(final_color);
		//out_transparency = vec4(0,0,0,1);
		imageStore(image_prev, ivec2(gl_FragCoord.xy), vec4(0,0,0,-1));
		return;
	}
	
	uint index = getPixelHeadAddress();
	
	// do lighting calculations
	vec3 light_position_ecs = (uniform_view * vec4(uniform_light_position, 1)).xyz;
	
	vec4 prev_last = vec4(0,0,0,-1);
	for (int i = counter-1; i >=0; --i)
	{
		// unpack
		uvec4 packed_data = nodes[index + i].data;
		vec4 albedo_opacity = unpackUnorm4x8(packed_data.y);
		vec2 normal_packed = unpackUnorm2x16(packed_data.z);
		vec4 spec_coef = unpackUnorm4x8(packed_data.w);
		float depth = uintBitsToFloat(packed_data.x);
		vec3 normal_unclamped = normal_decode_spheremap1(normal_packed.rg);
		
		final_color.rgb = calculateLighting(light_position_ecs, depth, albedo_opacity.rgb, albedo_opacity.a, normal_unclamped.rgb, spec_coef.rgb, final_color.rgb, final_color.a);
		
		// write prev value
		prev_last = vec4(normal_unclamped.z, 0, 0, 1);
	}	

	imageStore(image_prev, ivec2(gl_FragCoord.xy), prev_last);
	out_transparency = vec4(final_color.rgb, 1);
}
// KB_MDT_32
#elif defined(KB_MDT_32)
layout(binding = 0, rgba32ui) readonly uniform  uimage2DArray image_peel_data;
layout(binding = 1, r32ui   ) readonly uniform  uimage2DArray image_peel_depth;
layout(binding = 2, r32ui) readonly uniform uimage2D image_k_map;
layout(binding = 3, rgba32f) writeonly uniform image2D		image_prev;

uint getPixelFragDepthValue(const int coord_z) {return imageLoad (image_peel_depth, ivec3(gl_FragCoord.xy, coord_z)).r;}
uvec4 getPixelFragDataValue(const int coord_z) {return imageLoad (image_peel_data, ivec3(gl_FragCoord.xy, coord_z));}
uint getMaxPixelKValue	   (				 ) { return imageLoad  (image_k_map, ivec2(gl_FragCoord.xy)).r;}

vec2 fragments[KBUFFER_SIZE];

void main(void)
{
	// this can be optimized. simple implementation
	int  counter=0; 
	uint Zi=0u;
	int per_pixel_k = int(getMaxPixelKValue());
	// I am not removing counter < KBUFFER_SIZE for optimization purposes
	while(counter < KBUFFER_SIZE && counter < per_pixel_k && (Zi = getPixelFragDepthValue(counter)) < 0xFFFFFFFFU)
	{
		counter++; 
	}
	
	// do lighting calculations
	vec3 light_position_ecs = (uniform_view * vec4(uniform_light_position, 1)).xyz;
	
	vec4 final_color = vec4(0);
	vec4 prev_last = vec4(0,0,0,-1);
	for (int i = counter-1; i >=0; --i)
	{
		// unpack
		uvec4 packed_data = getPixelFragDataValue(i);
		vec4 albedo_opacity = unpackUnorm4x8(packed_data.r);
		vec2 normal_packed = unpackUnorm2x16(packed_data.g);
		vec4 spec_coef = unpackUnorm4x8(packed_data.b);
		float depth = uintBitsToFloat(getPixelFragDepthValue(i));
		float fragment_alpha = albedo_opacity.a;
		vec3 normal_unclamped = normal_decode_spheremap1(normal_packed.rg);
				
		final_color.rgb = calculateLighting(light_position_ecs, depth, albedo_opacity.rgb, albedo_opacity.a, normal_unclamped.rgb, spec_coef.rgb, final_color.rgb, final_color.a);

		// write prev value
		prev_last = vec4(normal_unclamped.z, 0, 0, 1);
	}	

	imageStore(image_prev, ivec2(gl_FragCoord.xy), prev_last);
	out_transparency = vec4(final_color.rgb,final_color.a);
}
#endif