//----------------------------------------------------//
//													  // 
// Copyright: Athens University of Economics and	  //
// Business											  //
// Authors: Kostas Vardis, Georgios Papaioannou   	  //
// 													  //
// If you use this code as is or any part of it in    //
// any kind of project or product, please acknowledge // 
// the source and its authors.						  //
//                                                    //
//----------------------------------------------------//
#version 330 core

layout(location = 0) out vec4 out_color;
in vec2 TexCoord;
uniform sampler2D sampler_buffer;
uniform int uniform_num_channels;

void main(void)
{
	vec4 tex_color = texture(sampler_buffer, TexCoord.xy);

	if (uniform_num_channels == 1)
		out_color = vec4(tex_color.rrr, 1);
	else if (uniform_num_channels == 2)
		out_color = vec4(tex_color.rg, 0, 1);
	else if (uniform_num_channels == 3)
		out_color = vec4(tex_color.rgb, 1);
	else
		out_color = vec4(tex_color.rgba);
}
