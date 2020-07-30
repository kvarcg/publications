// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// S-Buffer fragment implementation of Peel stage
// S-buffer: Sparsity-aware Multi-fragment Rendering (Short Eurographics 2012)
// http://dx.doi.org/10.2312/conf/EG2012/short/101-104
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "data_structs.h"

#define __Z_COORD_SPACE__
#define __STORE_BUFFER__

uniform sampler2D sampler_color;
uniform sampler2D sampler_bump;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_emission;

uniform uint	uniform_texture_mask;
uniform vec4	uniform_material_color;
uniform float	uniform_reflectance;
uniform vec3	uniform_emission;
uniform float	uniform_gloss;
uniform float	uniform_metallic;
uniform vec3	uniform_ior;
uniform int		uniform_lighting_buffer_enabled;

in vec3 Necs;
in vec3 Tecs;
in vec3 Becs;
in vec2 TexCoord;
in vec4 vertex_color;
in float pecsZ;

layout(binding = 1, r32ui	) coherent  uniform  uimage2D	  image_head;
#if		defined (BUFFER_IMAGE)
layout(binding = 2, rgba32f	) writeonly uniform  imageBuffer image_peel;
#elif	defined (BUFFER_STRUCT)
layout(binding = 2, std430	) writeonly buffer   SBUFFER	{ NodeTypeDataSB nodes []; };
#endif

uint addPixelHeadAddress(									) { return	imageAtomicAdd	(image_head, ivec2(gl_FragCoord.xy), 1U);}
#if		defined (BUFFER_IMAGE)
void sharedPoolSetValue (const uint index, const  vec4 val	) {			imageStore		(image_peel, int(index), val);}
#endif		

#include "normal_compression.h"

void main(void)
{
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);
	if (tex_color.a < 0.5) return;

	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;
	uint hasspec = (uniform_texture_mask & 0x04u) >> 2u;
	uint hasemis = (uniform_texture_mask & 0x08u) >> 3u;

	vec4 tex_comb = uniform_material_color * vertex_color * tex_color;

	if (uniform_lighting_buffer_enabled > 0)
		tex_comb.rgb = vec3(1);
	
	vec4 out_albedo = vec4(0);
	out_albedo.rgb = tex_comb.rgb;
	
	// emission
	float em = (uniform_emission.x+uniform_emission.y+uniform_emission.z)/3.0;
	if (hasemis > 0u)
	{
		em *= texture(sampler_emission, TexCoord.st).r;
	}
	float emission_mult = 0.0;
	if (em <= 1.0)
		out_albedo.a = em;
	else
	{
		//em = 3994.0;
		emission_mult = 1.0;
		out_albedo.a = em / 1000.0;
	}

	// normal
	vec3 newN = Necs;
	if (hasbump > 0u)
	{
		vec4 nmap = texture(sampler_bump, TexCoord.st);
		float heigh_prev_U = textureOffset(sampler_bump, TexCoord.st,ivec2(-1,0)).r;
		float heigh_prev_V = textureOffset(sampler_bump, TexCoord.st,ivec2(0,-1)).r;
		newN+= -2.0*(Tecs*(nmap.r-heigh_prev_U) + Becs*(nmap.r-heigh_prev_V));
	}
	newN = normalize(newN);
	vec2 out_normal = vec2(0);
	out_normal.xy = normal_encode_spheremap1(newN);

	vec4 spec_coefs = vec4(uniform_reflectance, uniform_gloss, uniform_metallic, 1.0);
	if (hasspec > 0u)
	{
		spec_coefs = texture(sampler_specular, TexCoord.st);		
	}
	vec4 out_specular = spec_coefs;

	// A-buffer Address Position
	uint  index	= addPixelHeadAddress();

	float Z;
#if		defined (PROJECTIVE_Z)
	Z = gl_FragCoord.z;
#elif	defined (CAMERA_Z)
	Z = pecsZ;
#endif	
	
	vec4 out_ior_opacity = vec4(uniform_ior.x / 10.0, uniform_material_color.a, emission_mult, 0);
#if		defined (BUFFER_IMAGE)
	sharedPoolSetValue (index,  vec4(
	uintBitsToFloat(packUnorm4x8(out_albedo)),
	Z,
	uintBitsToFloat(packUnorm2x16(out_normal)),
	uintBitsToFloat(packUnorm4x8(out_specular))
	));
#elif	defined (BUFFER_STRUCT)
	nodes[index].depth		= Z;
	nodes[index].albedo		= packUnorm4x8(out_albedo);
	nodes[index].normal		= packUnorm2x16(out_normal);
	nodes[index].specular	= packUnorm4x8(out_specular);	
	// ior is set to zero of the object is opaque
	// scale ior to be below 1.0
	nodes[index].ior_opacity = packUnorm4x8(out_ior_opacity);
#endif
}