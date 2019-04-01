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
uniform sampler2D sampler_specular;

float gaussian_blur[4];
uniform vec2 uniform_texel_step;
uniform vec2 uniform_texel_scale;

void main(void)
{
	// blur
	vec2 TexCoordScaled = vec2(TexCoord.xy * uniform_texel_scale);

	vec4 spec_surface = texture(sampler_specular, TexCoordScaled.xy).rrrr;
	vec3 ks = spec_surface.xyz;
	if (all(lessThanEqual(ks,vec3(0)))) discard;

	gaussian_blur[0] = 0.383;
	gaussian_blur[1] = 0.222;
	gaussian_blur[2] = 0.061;
	gaussian_blur[3] = 0.026;

	vec2 uniform_texel_step2 = uniform_texel_step;
	
	float step_value = uniform_texel_scale.x;
	if (uniform_texel_step2.x == 0) step_value *= uniform_texel_step2.y;
	else step_value *= uniform_texel_step2.x;

	float current_depth = texture(sampler_depth, TexCoordScaled.xy).r;
	float range_mult = abs(dFdx(current_depth)) + abs(dFdy(current_depth));

	float depthx1 = texture(sampler_depth, TexCoordScaled.xy - 2.0 * vec2(step_value, 0)).r;
	float depthx2 = texture(sampler_depth, TexCoordScaled.xy + 2.0 * vec2(step_value, 0)).r;
	float depthy1 = texture(sampler_depth, TexCoordScaled.xy - 2.0 * vec2(0, step_value)).r;
	float depthy2 = texture(sampler_depth, TexCoordScaled.xy + 2.0 * vec2(0, step_value)).r;

	float depth_x = abs(current_depth - depthx2);
	float depth_y = abs(current_depth - depthy2);

	range_mult = depth_x + depth_y;
	range_mult *= 10;
	
	range_mult = clamp(range_mult, 0.0, 1.0);
	range_mult = mix(1.6, 0.2, range_mult);
	range_mult = 0.5;

	vec2 TexCoordStep = uniform_texel_step2 * uniform_texel_scale * range_mult;

	vec2 clamp_max = uniform_texel_scale - uniform_texel_step2 * range_mult;
	
	vec2 texcoords[6];
	texcoords[0] = clamp(TexCoordScaled.xy + 1.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max);
	texcoords[1] = clamp(TexCoordScaled.xy - 1.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max);
	texcoords[2] = clamp(TexCoordScaled.xy + 2.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max);
	texcoords[3] = clamp(TexCoordScaled.xy - 2.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max);
	texcoords[4] = clamp(TexCoordScaled.xy + 3.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max);
	texcoords[5] = clamp(TexCoordScaled.xy - 3.0 * TexCoordStep.xy, vec2(0.0, 0.0), clamp_max);

	float spec_weights[6];
	spec_weights[0] = (texture(sampler_specular, texcoords[0]).rgb == vec3(0)) ? 0.0 : 1.0;
	spec_weights[1] = (texture(sampler_specular, texcoords[1]).rgb == vec3(0)) ? 0.0 : 1.0;
	spec_weights[2] = (texture(sampler_specular, texcoords[2]).rgb == vec3(0)) ? 0.0 : 1.0;
	spec_weights[3] = (texture(sampler_specular, texcoords[3]).rgb == vec3(0)) ? 0.0 : 1.0;
	spec_weights[4] = (texture(sampler_specular, texcoords[4]).rgb == vec3(0)) ? 0.0 : 1.0;
	spec_weights[5] = (texture(sampler_specular, texcoords[5]).rgb == vec3(0)) ? 0.0 : 1.0;

	vec4 tex_color = texture(sampler_input, TexCoordScaled.xy)  * gaussian_blur[0];
	tex_color += texture(sampler_input, texcoords[0]) * gaussian_blur[1];// * spec_weights[0];
	tex_color += texture(sampler_input, texcoords[1]) * gaussian_blur[1];// * spec_weights[1];
	tex_color += texture(sampler_input, texcoords[2]) * gaussian_blur[2];// * spec_weights[2];
	tex_color += texture(sampler_input, texcoords[3]) * gaussian_blur[2];// * spec_weights[3];
	tex_color += texture(sampler_input, texcoords[3]) * gaussian_blur[3];// * spec_weights[3];
	tex_color += texture(sampler_input, texcoords[4]) * gaussian_blur[3];// * spec_weights[3];

	tex_color = texture(sampler_input, TexCoordScaled.xy);
	out_color = vec4(tex_color.rgba);
}
