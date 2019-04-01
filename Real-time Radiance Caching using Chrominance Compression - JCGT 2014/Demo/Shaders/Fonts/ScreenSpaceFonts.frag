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
uniform sampler2D sampler_texture_atlas;
uniform vec4 uniform_text_color;
uniform int uniform_is_shadow;

void main(void)
{
	ivec2 texs = textureSize(sampler_texture_atlas, 0);

	vec2 texture_alpha = texture(sampler_texture_atlas, TexCoord.xy).rg;
	
	vec4 color = uniform_text_color;
	// make the main alpha more pronounced, makes small text sharper
	if (uniform_is_shadow > 0)
	{
		//texture_alpha = `clamp(texture_alpha * 20.0, 0.0, 0.8);
		float blurred_alpha = 0.0;
		
		vec2 textureStep = 2.0 / vec2(textureSize(sampler_texture_atlas, 0));

		// read neighboring pixel intensities
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(-1, -1)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(-1, 0)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(-1, 1)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(0, -1)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(0, 1)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(1, -1)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(1, 0)).r;
		//texture_alpha += texture(sampler_texture_atlas, TexCoord + textureStep * vec2(1, 1)).r;
		//texture_alpha /= 9.0;
	}

	float font_alpha = texture_alpha.r;

	vec4 text_color = color;

	out_color = vec4(clamp(text_color.rgb, 0, 1), font_alpha);
}
