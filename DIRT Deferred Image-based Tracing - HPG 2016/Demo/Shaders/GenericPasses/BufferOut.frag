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
uniform int uniform_enforce_gamma;
uniform float uniform_gamma;

void main(void)
{
	vec4 final_value = texture(sampler_buffer, TexCoord.xy);
	
	if (uniform_enforce_gamma == 1)
	{
		vec3 g = vec3(1.0 / uniform_gamma);
		final_value.rgb = pow(final_value.rgb, g);
	}

	out_color =  final_value;
}
