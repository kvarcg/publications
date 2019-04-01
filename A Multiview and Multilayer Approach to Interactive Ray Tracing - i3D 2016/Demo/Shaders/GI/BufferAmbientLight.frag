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
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_occlusion;
uniform sampler2D sampler_depth;
uniform vec3 uniform_ambient_light_color;
uniform vec3 uniform_background_color;
uniform mat4 uniform_view_inverse;

void main(void)
{
	float current_depth = texture(sampler_depth, TexCoord.xy).r;
	if (current_depth == 1.0)
	{
		out_color = vec4(uniform_background_color, 1);
		return;
	}

	vec4 occlusion = texture(sampler_occlusion, TexCoord.xy);
	vec4 kd = texture(sampler_albedo, TexCoord.xy);
	out_color = occlusion.x * vec4(kd.rgb * uniform_ambient_light_color.rgb + kd.rgb*(1-kd.a), 1);
}
