// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for previewing the buffers

#version 440 core
in vec2 TexCoord;

layout(location = 0) out vec4 out_color;

uniform sampler2DArray uniform_sampler_array;
uniform sampler2D uniform_sampler;

layout(binding = 2, rgba32f)	coherent uniform image2DArray   preview_ray_buffer;
layout(binding = 3, rgba32f)	coherent uniform image2D   preview_a_buffer;

#define OPERATORS_LAYER 0
#define DEBUG_LAYER 1
#define STATISTICS_LAYER 2
#define FINAL_VIEW_LAYER 3
#define RAY_OFFSET_LAYER 4

uniform vec2 uniform_slice_info;

void main(void)
{	
	vec4 final_color = vec4(0);
	// write the stored rays to the associated preview texture 
	if (uniform_slice_info.y == 4)
	{
		vec4 ray_color = imageLoad(preview_ray_buffer, ivec3(gl_FragCoord.xy, RAY_OFFSET_LAYER + uniform_slice_info.x));
		if (ray_color.w < 0)
		{
			ivec2 cur_pixel = ivec2(gl_FragCoord.xy);
			imageStore(preview_a_buffer, cur_pixel.xy + ivec2(0,0),			vec4(ray_color.rgb, 1));
		}
		return;
	}

	// write the preview texture to the Preview Rays texture
	if (uniform_slice_info.x >= 0)
	{
		final_color = texture(uniform_sampler_array, vec3(TexCoord.st * uniform_slice_info.y, uniform_slice_info.x));
	}
	else
		final_color = vec4(texture(uniform_sampler, TexCoord.st));

	imageStore(preview_ray_buffer, ivec3(gl_FragCoord.xy, FINAL_VIEW_LAYER), vec4(final_color));
}
