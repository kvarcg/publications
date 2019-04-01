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
	gaussian_blur[0] = 0.383;
	gaussian_blur[1] = 0.222;
	gaussian_blur[2] = 0.061;
	gaussian_blur[3] = 0.026;

	// depth-aware cross bilateral fil
	vec2 TexCoordScaled = vec2(TexCoord.xy * uniform_texel_scale);
		
	float step_value = uniform_texel_scale.x;
	if (uniform_texel_step.x == 0) step_value *= uniform_texel_step.y;
	else step_value *= uniform_texel_step.x;

	float current_depth = texture(sampler_depth, TexCoordScaled.xy).r;

	float depthx1 = texture(sampler_depth, TexCoordScaled.xy - 2.0 * vec2(step_value, 0)).r;
	float depthx2 = texture(sampler_depth, TexCoordScaled.xy + 2.0 * vec2(step_value, 0)).r;
	float depthy1 = texture(sampler_depth, TexCoordScaled.xy - 2.0 * vec2(0, step_value)).r;
	float depthy2 = texture(sampler_depth, TexCoordScaled.xy + 2.0 * vec2(0, step_value)).r;
	float absdepth_x2 = abs(current_depth - depthx2);
	float absdepth_y2 = abs(current_depth - depthy2);
	float absdepth_x = abs(current_depth - depthx1);
	float absdepth_y = abs(current_depth - depthy1);

	float range_mult = max(absdepth_y2, max(absdepth_x2, max(absdepth_x, absdepth_y)));
	
	range_mult *= 100;
	range_mult = clamp(range_mult, 0.0, 1.0);
	range_mult = mix(3.0, 0.5, range_mult);

	float sampling_range = range_mult * 0.33;
	vec2 TexCoordStep = uniform_texel_step * uniform_texel_scale * sampling_range * 1;
	vec4 tex_color = texture(sampler_input, TexCoordScaled.xy)  * gaussian_blur[0];
	tex_color += texture(sampler_input, TexCoordScaled.xy + 1.0 * TexCoordStep.xy) * gaussian_blur[1];
	tex_color += texture(sampler_input, TexCoordScaled.xy - 1.0 * TexCoordStep.xy) * gaussian_blur[1];
	tex_color += texture(sampler_input, TexCoordScaled.xy + 2.0 * TexCoordStep.xy) * gaussian_blur[2];
	tex_color += texture(sampler_input, TexCoordScaled.xy - 2.0 * TexCoordStep.xy) * gaussian_blur[2];
	tex_color += texture(sampler_input, TexCoordScaled.xy + 3.0 * TexCoordStep.xy) * gaussian_blur[3];
	tex_color += texture(sampler_input, TexCoordScaled.xy - 3.0 * TexCoordStep.xy) * gaussian_blur[3];

	out_color = vec4(tex_color.rgba);
}
