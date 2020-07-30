//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
//                                                    //
//----------------------------------------------------//
#version 330 core

layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_buffer;
uniform usampler2D usampler_buffer;
uniform isampler2D isampler_buffer;
uniform sampler2DArray sampler_array_buffer;
uniform usampler2DArray usampler_array_buffer;
uniform isampler2DArray isampler_array_buffer;
uniform samplerCube sampler_cube_buffer;
uniform usamplerCube usampler_cube_buffer;
uniform isamplerCube isampler_cube_buffer;

uniform int uniform_slice;
uniform int uniform_num_channels;
uniform int uniform_buffer_type;
uniform float uniform_scale_factor;

uniform int uniform_enforce_gamma;
uniform float uniform_gamma;

#include "utilities.h"
#include "normal_compression.h"

void main(void)
{
	vec4 tex_color = vec4(0);
	
	if (uniform_buffer_type == 0)
		tex_color = vec4(texture(sampler_buffer, TexCoord.xy));
	else if (uniform_buffer_type == 1)
		tex_color = vec4(texture(isampler_buffer, TexCoord.xy));
	else if (uniform_buffer_type == 2)
		tex_color = vec4(texture(usampler_buffer, TexCoord.xy));
	else if (uniform_buffer_type == 3)
		tex_color = vec4(texture(sampler_array_buffer, vec3(TexCoord.xy, uniform_slice)));
	else if (uniform_buffer_type == 4)
		tex_color = vec4(texture(usampler_array_buffer, vec3(TexCoord.xy, uniform_slice)));
	else if (uniform_buffer_type == 5)
		tex_color = vec4(texture(isampler_array_buffer, vec3(TexCoord.xy, uniform_slice)));
	else if (uniform_buffer_type == 6)
	{
		vec3 cube_xyz = convert_cube_uv_to_xyz(uniform_slice, TexCoord.xy);
		tex_color = vec4(texture(sampler_cube_buffer, cube_xyz));
	}
	else if (uniform_buffer_type == 7)
		tex_color = vec4(texture(usampler_cube_buffer, vec3(TexCoord.xy, uniform_slice)));
	else if (uniform_buffer_type == 8)
		tex_color = vec4(texture(isampler_cube_buffer, vec3(TexCoord.xy, uniform_slice)));

	tex_color *= uniform_scale_factor;

	vec4 final_value = vec4(0);

	if (uniform_num_channels == 1)
	{
		float f = tex_color.r;
		final_value = vec4(f,f,f,1);
	}
	else if (uniform_num_channels == 2)
	{
		final_value = vec4(tex_color.rg, 0, 1);
	}
	else if (uniform_num_channels == 3)
	{
		final_value = vec4(tex_color.rgb, 1);
	}
	else
	{	
		final_value = vec4(tex_color.rgba);
	}

	if (uniform_enforce_gamma == 1)
	{
		vec3 g = vec3(1.0 / uniform_gamma);
		final_value.rgb = pow(final_value.rgb, g);
	}

	out_color = final_value;
}

