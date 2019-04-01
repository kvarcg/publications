// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the caching stage
#version 330 core

#define __COMPRESSION_METHOD__
#define __OCCLUSION__

#define NUM_OCCLUSION_SAMPLES __NUM_OCCLUSION_SAMPLES__
#define __OCCUPANCY_OPTIMIZATION__

layout(location = 0) out vec4 out_data0;
layout(location = 1) out vec4 out_data1;
layout(location = 2) out vec4 out_data2;
layout(location = 3) out vec4 out_data3;
layout(location = 4) out vec4 out_data4;
layout(location = 5) out vec4 out_data5;
layout(location = 6) out vec4 out_data6;

in vec2 TexCoord;

uniform sampler2D sampler_shadow_depth;
uniform sampler2D sampler_shadow_color;
uniform sampler2D sampler_shadow_normal;
uniform usampler2D sampler_occlusion;
uniform int uniform_num_samples;
uniform mat4 uniform_L_mvp;
uniform mat4 uniform_L_mvp_inv;
uniform mat4 uniform_L_ecs_inv;
uniform vec3 uniform_bbox_min;
uniform float uniform_spread;
uniform vec3 uniform_light_pos;
uniform vec3 uniform_light_dir;
uniform vec3 uniform_stratum;
uniform vec3 uniform_occlusion_bmin;
uniform vec3 uniform_occlusion_bextents;
uniform float uniform_occlusion_res_z;
uniform vec3 uniform_occlusion_stratum;
uniform int uniform_bounces;
uniform vec2 uniform_samples_2d[200];
uniform vec3 uniform_samples_3d[200];
uniform sampler3D sampler_occupancy;

flat in int vCurrentLayer;

vec3 RGB2YCoCg(vec3 rgbColor)
{
	return vec3(
	 rgbColor.r * 0.25 + rgbColor.g * 0.5 + rgbColor.b * 0.25,
	 rgbColor.r * 0.5 					  - rgbColor.b * 0.5,
	-rgbColor.r * 0.25 + rgbColor.g * 0.5 - rgbColor.b * 0.25
	);
}

void projectDirToOrder2Basis ( const in vec3 dir, out float sh00,
			   out float sh1_1, out float sh10, out float sh11,
			   out float sh2_2, out float sh2_1, out float sh20, out float sh21, out float sh22)
{
	sh00    = 0.282094792;
	sh1_1   = -0.488602512 * dir.y;
	sh10    = 0.488602512 * dir.z;
	sh11    = -0.488602512 * dir.x;
	sh2_2   = 1.092548431 * dir.y*dir.x;
	sh2_1   = 1.092548431 * dir.y*dir.z;
	sh20	= 0.946174695 * dir.z * dir.z - 0.315391565;
	sh21    = 1.092548431 * dir.x*dir.z;
	sh22    = 0.546274215 * (dir.x*dir.x - dir.y*dir.y);
}

void encodeRadianceToSH (in vec3 dir, in vec3 L, out vec3 L00,
					out vec3 L1_1, out vec3 L10, out vec3 L11,
					out vec3 L2_2, out vec3 L2_1, out vec3 L20, out vec3 L21, out vec3 L22)
{
	float sh00, sh1_1, sh10, sh11, sh2_2, sh2_1, sh20, sh21, sh22;
	projectDirToOrder2Basis ( dir, sh00, sh1_1, sh10, sh11, sh2_2, sh2_1, sh20, sh21, sh22 );

	L00   = L * sh00; 
	L1_1  = L * sh1_1;
	L10   = L * sh10; 
	L11   = L * sh11; 
	L2_2  = L * sh2_2;
	L2_1  = L * sh2_1;
	L20   = L * sh20; 
	L21   = L * sh21; 
	L22   = L * sh22; 
}

vec2 ShadowProjection( in vec3 point_WCS )
{
	vec4 pos_LCS = uniform_L_mvp*vec4(point_WCS+vec3(0.01,0.01,0.01),1.0);
	pos_LCS /= pos_LCS.w;
	float reverse = sign(dot(uniform_light_dir,point_WCS - uniform_light_pos));
	vec2 uv = vec2(reverse * 0.5 * pos_LCS.xy + 0.5);
	return clamp(uv,vec2(0.0,0.0),vec2(1.0,1.0));
}

vec3 WCS2LCSS( in vec3 point_WCS )
{
	vec4 pos_LCS = uniform_L_mvp*vec4(point_WCS+vec3(0.01,0.01,0.01),1.0);
	pos_LCS/=pos_LCS.w;
	float reverse = sign(dot(uniform_light_dir,point_WCS-uniform_light_pos));
	return pos_LCS.xyz*reverse;
}

vec3 normal_decode_spheremap1(vec2 pixel)
{
	vec2 fenc = pixel*4-2;
	float f = dot(fenc,fenc);
	float g = sqrt(1-f/4);
	vec3 n;
	n.xy = fenc*g;
	n.z = 1-f/2;
	return n;
}

void main()
{
	// get the coordinates of the current voxel
	// gl_FragCoord returns the coordinates at the center of the pixel (0.5, 0.5)
	vec3 voxel_coord = vec3(gl_FragCoord.xy, vCurrentLayer+0.5);
		
	#ifdef OCCUPANCY_OPTIMIZATION
		float occupancy = texelFetch(sampler_occupancy, ivec3(voxel_coord), 0).a;
		if (occupancy < 1.0) discard;
	#endif
	
	vec4 smc		= vec4(0.0,0.0,0.0,0.0);
	vec3 smp		= vec3(0.0,0.0,0.0);
	vec3 smn		= vec3(0.0,0.0,0.0);
	
	vec3  SH_00		= vec3(0.0,0.0,0.0); 
	vec3  SH_1_1	= vec3(0.0,0.0,0.0); 
	vec3  SH_10		= vec3(0.0,0.0,0.0);
	vec3  SH_11		= vec3(0.0,0.0,0.0); 
	vec3  SH_2_2	= vec3(0.0,0.0,0.0);
	vec3  SH_2_1	= vec3(0.0,0.0,0.0); 
	vec3  SH_20		= vec3(0.0,0.0,0.0); 
	vec3  SH_21		= vec3(0.0,0.0,0.0);
	vec3  SH_22		= vec3(0.0,0.0,0.0); 

	// position is initialized at the center of the current voxel
	vec3 pos_wcs = uniform_bbox_min + vec3(voxel_coord) * uniform_stratum;
	vec2 l_uv = ShadowProjection(pos_wcs);
	
	float stratum_length = length(uniform_stratum);
	float occlusion_stratum_length = length(uniform_occlusion_stratum);

	vec2 uv_avg = vec2(0);

	ivec2 rsm_size = textureSize(sampler_shadow_color,0);
	
	float sp = uniform_spread;

	// the number of samples passed in the shader is the
	// total number of samples / number of lights
	float A_total = 0.0;
	float inv_pdf = rsm_size.x*rsm_size.y*sp*sp;

	// clamp the sampling center based on the spread parameter
	vec2 uv_c = vec2(clamp(l_uv.xy, vec2(sp * 0.499), vec2(1.0 - sp * 0.499)));
	// the samples are generated in the range [0,1] with origin (0,0) so move the sampling center
	// to coincide with the sample origin
	uv_c -= (0.5 * vec2(sp));
	
	for (int i = 0; i < uniform_num_samples; ++i)
	{
		// get a random RSM sample in uv coordinates and project it in the RSM depth buffervs
		vec2 uv = uv_c + uniform_samples_2d[i] * sp;

		float depth = texture(sampler_shadow_depth, uv).r;
		
		uv_avg += uv;

		// get the position of the projected sample, its color and its normal in WCS
		vec4 pos_LCS = vec4 (vec3(uv.xy, depth) * 2.0 - 1.0, 1.0);
		pos_LCS = uniform_L_mvp_inv * pos_LCS;
		smp = pos_LCS.xyz/pos_LCS.w;
		smc = texture(sampler_shadow_color, uv);

		vec3 ntex = normal_decode_spheremap1(texture(sampler_shadow_normal,uv).xy);
		ntex = vec3(uniform_L_ecs_inv * vec4(ntex,0)).xyz;
		smn = normalize(ntex);
		
		// get a random position in wcs
		// pos_wcs is located at the center of the voxel and the samples are in the range of [0,1]
		vec3 p = pos_wcs + (uniform_samples_3d[i] * vec3(0.5)) * uniform_stratum;

		float dist = distance(p, smp);

		if (dist < stratum_length) continue;
		
		vec3 dir = (dist <= 0.007) ? vec3(0,0,0) : normalize (p-smp);

		// calculate the form factor and the radiance of the sample position
		float dotprod = max(dot(dir,smn),0.0);

		if (dotprod < 0.07) continue;

		float vis = 1.0;

#ifdef OCCLUSION
		// number of intermediate steps
		// create a jittered offset in the range of [0, 1]
		vec3 voxel_marching_dir = normalize(smp - p);
		vec3 occlusion_jitter = voxel_marching_dir * uniform_samples_2d[i].x * occlusion_stratum_length * 0.5;
		vec3 offset = voxel_marching_dir * occlusion_stratum_length;
		// fix for the case where the distance to the RSM is smaller than the offset. 0.4 is similar to 1.0 / 2.5 (total offsets)
		float length_offset = min(length(smp - p) * 0.4, length(offset));
		offset = normalize(offset) * length_offset;
		vec3 start_pos = p + offset + occlusion_jitter;
		vec3 end_pos = smp - offset;
		vec3 voxel_marching_step = voxel_marching_dir;
		voxel_marching_step *= length(end_pos - start_pos) / (NUM_OCCLUSION_SAMPLES - 1);
		vec2 texelStep = vec2(0.0) / textureSize(sampler_occlusion, 0);
		vec3 sample_pos;
		vec3 voxel_pos;
		int cur_i = -1;
		
		for (int j = 0; j < NUM_OCCLUSION_SAMPLES; j++)
		{
			sample_pos = start_pos + j * voxel_marching_step;
			voxel_pos = (sample_pos - uniform_occlusion_bmin) / uniform_occlusion_bextents;
	
			uvec4 slice = textureLod(sampler_occlusion, voxel_pos.xy, 0);
			uint voxel_z = uint(uniform_occlusion_res_z - floor((voxel_pos.z * uniform_occlusion_res_z) + 0.0) - 1);

			// get an unsigned vec4 containing the current position (marked as 1)
			uvec4 slicePos = uvec4(0u);
			slicePos[voxel_z / 32u] = 1u << (voxel_z % 32u);

			// use AND to mark whether the current position has been set as occupied
			uvec4 res = slice & slicePos;

			// check if the current position is marked as occupied
			if ((res.r | res.g | res.b | res.a) > 0u) 
			{
				vis = 0.0;
				j = NUM_OCCLUSION_SAMPLES;
				//break;
			}
		}
#endif // OCCLUSION	

		float FF = dotprod / float(0.01 + dist*dist);
		
		vec3 color = vis * smc.rgb * FF / (3.14159);

		// project the radiance onto spherical harmonics basis functions
		// store the radiance in the incoming direction
		
		vec3 sh_00, sh_1_1, sh_10, sh_11, sh_2_2, sh_2_1, sh_20, sh_21, sh_22;

#if defined (CONVERSION) || defined(LOW_COMPRESSION) || defined(HIGH_COMPRESSION)
		color = RGB2YCoCg(color);
#endif // COMPRESSION
		encodeRadianceToSH(-dir, color, sh_00, sh_1_1, sh_10, sh_11, sh_2_2, sh_2_1, sh_20, sh_21, sh_22);

		SH_00  += sh_00;
		SH_1_1 += sh_1_1;
		SH_10  += sh_10;
		SH_11  += sh_11;
		SH_2_2 += sh_2_2;
		SH_2_1 += sh_2_1;
		SH_20  += sh_20;
		SH_21  += sh_21;
		SH_22  += sh_22;
	}
	
	float divsamples = 1.0 / float(uniform_num_samples);

	// scale by 1/100 as flux is premultiplied by 100 upon saving in the RSM to avoid truncation errors.
	// this is used for precision issues during the RSM step and can be skipped
	float mult			= inv_pdf * divsamples * 0.01; 

#if defined (NOCOMPRESSION) || defined(CONVERSION)
		out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1.r)	* mult;
		out_data1			= vec4 (SH_1_1.g,	SH_1_1.b,	SH_10.r,	SH_10.g)	* mult;
		out_data2			= vec4 (SH_10.b,	SH_11.r,	SH_11.g,	SH_11.b)	* mult;
		out_data3			= vec4 (SH_2_2.r,	SH_2_2.g,	SH_2_2.b,	SH_2_1.r)	* mult;
		out_data4			= vec4 (SH_2_1.g,	SH_2_1.b,	SH_20.r,	SH_20.g)	* mult;
		out_data5			= vec4 (SH_20.b,	SH_21.r,	SH_21.g,	SH_21.b)	* mult;
		out_data6.rgb		= vec3 (SH_22.r,	SH_22.g,	SH_22.b)				* mult;
		out_data6.a			= 1.0;
#elif defined(LOW_COMPRESSION)
		// compressing CoCg to 2nd order
		out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1.r)	* mult;
		out_data1			= vec4 (SH_1_1.g,	SH_1_1.b,	SH_10.r,	SH_10.g)	* mult;
		out_data2			= vec4 (SH_10.b,	SH_11.r,	SH_11.g,	SH_11.b)	* mult;
		out_data3			= vec4 (SH_2_2.r,	SH_2_1.r,	SH_20.r,	SH_21.r)	* mult;
		out_data4			= vec4 (SH_22.r,	0.0,		0.0,		0.0)		* mult;
		out_data4.b			= 1.0;
#elif defined(HIGH_COMPRESSION)
		// compressing CoCg to 1st order
		out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1.r)	* mult;
		out_data1			= vec4 (SH_10.r,	SH_11.r,	SH_2_2.r,	SH_2_1.r)	* mult;
		out_data2			= vec4 (SH_20.r,	SH_21.r,	SH_22.r,	0.0)		* mult;
		out_data2.a			= 1.0;
#endif // COMPRESSION
}
