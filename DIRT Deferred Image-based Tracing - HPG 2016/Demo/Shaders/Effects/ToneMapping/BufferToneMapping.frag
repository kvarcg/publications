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
uniform sampler2DArray sampler_buffer_array;
uniform float uniform_key;
uniform float uniform_L_white;
uniform float uniform_L_world;
uniform int uniform_skip;
uniform int uniform_auto;
uniform int uniform_layer;

#include "utilities.h"

void main(void)
{
	vec4 tex_color1 = texture(sampler_buffer, TexCoord.xy);
	vec4 tex_color2 = texture(sampler_buffer_array, vec3(TexCoord.xy, uniform_layer));
	
	vec4 tex_color = vec4(0);

	if (uniform_layer < 0) tex_color = tex_color1;
	else tex_color = tex_color2;
	
	float key = uniform_key;
	float white = uniform_L_white;
	vec3 final_color = tex_color.rgb;
	if (uniform_skip == 0)
	{
		vec3 hsv = rgb2hsv_normalized(tex_color.rgb);
		if (uniform_auto == 1)
		{
			float L = hsv.z * key / (uniform_L_world+0.0001);
			//float L_d = L * (1.0 + L/(white*white)) / (1.0 + L);
			float L_d = L + (L*L)/(white*white);
			L_d /= (1.0 + L);
			hsv.z = L_d;
		}
		else	
		{
			float expbias = pow(10.0, key);
			hsv.z = log(1.0001 + expbias*hsv.z) / log(1.0001 + expbias*white);	
		}
		final_color = hsv2rgb_normalized(hsv);
		final_color.rgb = clamp(final_color.rgb, vec3(0), vec3(1));
	}
	
	out_color.rgb = final_color.rgb;
	out_color.a = 1.0;
}
