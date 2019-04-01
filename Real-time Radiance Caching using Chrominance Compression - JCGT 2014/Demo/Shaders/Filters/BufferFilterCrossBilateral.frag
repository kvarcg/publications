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

	float current_depth = texture2D(sampler_depth, TexCoordScaled.xy).r;
	float range_mult = abs(dFdx(current_depth)) + abs(dFdy(current_depth));

	float depthx1 = texture2D(sampler_depth, TexCoordScaled.xy - 2.0 * vec2(step_value, 0)).r;
	float depthx2 = texture2D(sampler_depth, TexCoordScaled.xy + 2.0 * vec2(step_value, 0)).r;
	float depthy1 = texture2D(sampler_depth, TexCoordScaled.xy - 2.0 * vec2(0, step_value)).r;
	float depthy2 = texture2D(sampler_depth, TexCoordScaled.xy + 2.0 * vec2(0, step_value)).r;

	float depth_x = abs(current_depth - depthx2);
	float depth_y = abs(current_depth - depthy2);

	range_mult = depth_x + depth_y;
	range_mult *= 10;
	
	range_mult = clamp(range_mult, 0.0, 1.0);
	range_mult = mix(1.6, 0.2, range_mult);
	//range_mult = 2;

	vec2 TexCoordStep = uniform_texel_step2 * uniform_texel_scale * range_mult;

	vec2 clamp_max = uniform_texel_scale - uniform_texel_step2 * range_mult;
	
	vec4 tex_color = texture2D(sampler_input, TexCoordScaled.xy)  * gaussian_blur[0];
	tex_color += texture2D(sampler_input, clamp(TexCoordScaled.xy + TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[1];
	tex_color += texture2D(sampler_input, clamp(TexCoordScaled.xy - TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[1];
	tex_color += texture2D(sampler_input, clamp(TexCoordScaled.xy + 2.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[2];
	tex_color += texture2D(sampler_input, clamp(TexCoordScaled.xy - 2.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[2];
	tex_color += texture2D(sampler_input, clamp(TexCoordScaled.xy + 3.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[3];
	tex_color += texture2D(sampler_input, clamp(TexCoordScaled.xy - 3.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max)) * gaussian_blur[3];
	//tex_color /= (gaussian_blur[0] + gaussian_blur[1] * 2 + gaussian_blur[2] * 2 /*+ gaussian_blur[3] * 2*/);

	out_color = vec4(tex_color.rgba);
}
