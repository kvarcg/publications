// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// S-Buffer fragment implementation of Accumulate stage
// S-buffer: Sparsity-aware Multi-fragment Rendering (Short Eurographics 2012)
// http://dx.doi.org/10.2312/conf/EG2012/short/101-104
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

	uniform sampler2D sampler_color;

	uniform uint	uniform_texture_mask;

	in vec2 TexCoord;
	in vec4 vertex_color;

	layout(binding = 0, r32ui) coherent uniform uimage2D image_counter;
	layout(binding = 4, offset = 0)	    uniform atomic_uint total_counter;

	void addPixelFragCounter() {imageAtomicAdd(image_counter, ivec2(gl_FragCoord.xy), 1U);}

	void main(void)
	{
		uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
		vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);
		if (tex_color.a < 0.5) return;

		atomicCounterIncrement(total_counter);
		addPixelFragCounter();
	}