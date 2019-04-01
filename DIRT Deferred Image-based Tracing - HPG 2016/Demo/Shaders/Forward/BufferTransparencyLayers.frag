// Variable k-Buffer using Importance Maps (Short Eurographics 2017)
// https://diglib.eg.org/handle/10.2312/egsh20171005
// Authors: A.A. Vasilakis, K. Vardis, G. Papaioannou, K. Moustakas
// Fragment shader for the per-pixel count pass

#version 420 core

layout(location = 0) out vec4 out_frag_color;
uniform sampler2D sampler_color;
uniform sampler2D sampler_opacity;
uniform sampler2D sampler_bump;
uniform sampler2D sampler_depth;

uniform uint	uniform_texture_mask;
uniform vec4	uniform_material_color;
in vec3 Necs;
in vec3 Tecs;
in vec3 Becs;

in vec2 TexCoord;
in vec4 vertex_color;
layout(early_fragment_tests) in;

layout(binding = 0, r32ui)			coherent uniform uimage2D		image_layers;
layout(binding = 1, offset = 0)				  uniform atomic_uint	total_layers;

uint incrementPixel	() { return imageAtomicAdd	  (image_layers, ivec2(gl_FragCoord.xy), 1u);}

void main(void)
{
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);
	vec4 tex_comb = uniform_material_color * vertex_color * tex_color;
	if (tex_comb.a <= 0.0) return;
	
	incrementPixel();
	atomicCounterIncrement(total_layers);
}
