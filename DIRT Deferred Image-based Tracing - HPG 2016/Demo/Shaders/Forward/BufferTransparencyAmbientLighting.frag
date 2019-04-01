// Variable k-Buffer using Importance Maps (Short Eurographics 2017)
// https://diglib.eg.org/handle/10.2312/egsh20171005
// Authors: A.A. Vasilakis, K. Vardis, G. Papaioannou, K. Moustakas
// Fragment shader for the ambient lighting calculations

#version 440 core

#include "data_structs.h"

layout(location = 0) out vec4 out_transparency;
in vec2 TexCoord;

uniform vec3 uniform_ambient_light_color;
uniform mat4 uniform_proj_inverse;
uniform sampler2D sampler_lighting;

#include "depth_reconstruction.h"
#include "normal_compression.h"
#include "microfacet_direct_lighting.h"

vec3 calculateLighting(vec3 ambient_light, float depth, vec3 albedo, float fragment_opacity, vec3 normal, vec3 spec_parameters, vec3 prev_color, float prev_alpha)
{		
	vec3 brdf =  Lambert_BRDF(albedo.rgb);
	vec3 dirColor = brdf * ambient_light.rgb;

	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, depth);
	vec3 vertex_to_view_direction = -normalize(pecs.xyz);
	if (dot(pecs, normal) > 0) normal = -normal;

	vec3 T = Transmittance(normal, normal, normal, albedo, spec_parameters);
	
	vec3 fragment_color = dirColor.rgb + albedo.rgb * T * (1-fragment_opacity) * prev_color.rgb;
	fragment_color.rgb = clamp(fragment_color.rgb, vec3(0), vec3(1));
	return fragment_color;
}

#define KBUFFER_SIZE			__ABUFFER_LOCAL_SIZE__
#define KBUFFER_SIZE_1n			KBUFFER_SIZE - 1
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
	vec4 final_color = texture(sampler_lighting, TexCoord.st);
	vec3 ambient_light = uniform_ambient_light_color.rgb;

	int counter = int(getPixelFragCounter());
	if(counter == 0 || all(equal(ambient_light.xyz, vec3(0))))
	{
		out_transparency = final_color;
		imageStore(image_prev, ivec2(gl_FragCoord.xy), vec4(0,0,0,-1));
		return;
	}
	
	uint index = getPixelHeadAddress();

	// if GI is enabled, ambient is 0. Pass a constant value
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
					  
		final_color.rgb = calculateLighting(ambient_light, depth, albedo_opacity.rgb, albedo_opacity.a, normal_unclamped, spec_coef.rgb, final_color.rgb, final_color.a);

		// write prev value
		prev_last = vec4(normal_unclamped.z, 0, 0, 1);
	}	

	imageStore(image_prev, ivec2(gl_FragCoord.xy), prev_last);
	// write nothing for now
	out_transparency = final_color;
}
// KB_MDT_32
#elif defined(KB_MDT_32)
layout(binding = 0, rgba32ui) readonly uniform  uimage2DArray image_peel_data;
layout(binding = 1, r32ui   ) readonly uniform  uimage2DArray image_peel_depth;
layout(binding = 2, r32ui) readonly uniform uimage2D image_k_map;
layout(binding = 3, rgba32f) writeonly uniform image2D		image_prev;

uint getPixelFragDepthValue(const int coord_z) {return imageLoad (image_peel_depth, ivec3(gl_FragCoord.xy, coord_z)).r;}
uvec4 getPixelFragDataValue(const int coord_z) {return imageLoad (image_peel_data, ivec3(gl_FragCoord.xy, coord_z));}
uint getMaxPixelKValue	   (				 ) {return imageLoad  (image_k_map, ivec2(gl_FragCoord.xy)).r;}

vec2 fragments[KBUFFER_SIZE];
void main(void)
{
	vec4 final_color = texture(sampler_lighting, TexCoord.st);
	vec3 ambient_light = uniform_ambient_light_color.rgb;
	if(all(equal(ambient_light.xyz, vec3(0))))
	{
		out_transparency = final_color;
		imageStore(image_prev, ivec2(gl_FragCoord.xy), vec4(0,0,0,-1));
		return;
	}
	
	// this can be optimized. simple implementation
	int  counter=0; 
	uint Zi=0u;
	int per_pixel_k = int(getMaxPixelKValue());
	// I am not removing counter < KBUFFER_SIZE for optimization purposes
	while(counter < KBUFFER_SIZE && counter < per_pixel_k && (Zi = getPixelFragDepthValue(counter)) < 0xFFFFFFFFU)
	{
		counter++; 
	}

	if(counter == 0)
	{
		out_transparency = final_color;
		imageStore(image_prev, ivec2(gl_FragCoord.xy), vec4(0,0,0,-1));
		return;
	}
	
	// if GI is enabled, ambient is 0. Pass a constant value

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
					  
		final_color.rgb = calculateLighting(ambient_light, depth, albedo_opacity.rgb, albedo_opacity.a, normal_unclamped, spec_coef.rgb, final_color.rgb, final_color.a);
		
		// write prev value
		prev_last = vec4(normal_unclamped.z, 0, 0, 1);
	}	

	imageStore(image_prev, ivec2(gl_FragCoord.xy), prev_last);
	// write nothing for now
	out_transparency = final_color;
}
#endif