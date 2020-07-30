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
uniform sampler2D sampler_texture_atlas;
uniform vec4 uniform_text_color;
uniform int uniform_is_shadow;

void main(void)
{
	vec2 texture_alpha = texture(sampler_texture_atlas, TexCoord.xy).rg;
	out_color = vec4(clamp(uniform_text_color.rgb, 0, 1), texture_alpha.r);
}
