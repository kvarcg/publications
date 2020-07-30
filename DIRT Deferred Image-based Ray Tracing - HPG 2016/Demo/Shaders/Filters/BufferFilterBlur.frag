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
uniform sampler2D sampler_input;
uniform sampler2D sampler_depth;

float gaussian_blur[4];
uniform vec2 uniform_texel_step;
uniform vec2 uniform_texel_scale;

void main(void)
{
	//gaussian_blur[0] = 1.0;
	//gaussian_blur[1] = 0.7165;
	//gaussian_blur[2] = 0.2636;
	gaussian_blur[0] = 0.383;
	gaussian_blur[1] = 0.222;
	gaussian_blur[2] = 0.061;
	gaussian_blur[3] = 0.026;

	vec2 uniform_texel_step2 = uniform_texel_step;

	// blur
	vec2 TexCoordScaled = vec2(TexCoord.xy * uniform_texel_scale);
	
	float step_value = uniform_texel_scale.x;
	if (uniform_texel_step2.x == 0) step_value *= uniform_texel_step2.y;
	else step_value *= uniform_texel_step2.x;

	float range_mult = 1;
	vec2 TexCoordStep = uniform_texel_step2 * uniform_texel_scale * range_mult;

	vec2 clamp_max = uniform_texel_scale - uniform_texel_step2 * range_mult;
	
	vec4 tex_color = texture(sampler_input, TexCoordScaled.xy)  * gaussian_blur[0];
	tex_color += texture(sampler_input, clamp(TexCoordScaled.xy + TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[1];
	tex_color += texture(sampler_input, clamp(TexCoordScaled.xy - TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[1];
	tex_color += texture(sampler_input, clamp(TexCoordScaled.xy + 2.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[2];
	tex_color += texture(sampler_input, clamp(TexCoordScaled.xy - 2.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[2];
	tex_color += texture(sampler_input, clamp(TexCoordScaled.xy + 3.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[3];
	tex_color += texture(sampler_input, clamp(TexCoordScaled.xy - 3.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[3];

	out_color = vec4(tex_color.rgba);
}
