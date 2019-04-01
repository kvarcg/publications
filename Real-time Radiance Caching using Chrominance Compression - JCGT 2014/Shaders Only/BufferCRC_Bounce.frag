// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the secondary bounce stage

#version 330 core

#define __COMPRESSION_METHOD__
	
//#define INC_BOUNCE	
#define NUM_OCCLUSION_SAMPLES 4
#define MAX_PARAMETRIC_DIST 0.5
#define OCCLUSION

layout(location = 0) out vec4 out_data0;
layout(location = 1) out vec4 out_data1;
layout(location = 2) out vec4 out_data2;
layout(location = 3) out vec4 out_data3;
layout(location = 4) out vec4 out_data4;
layout(location = 5) out vec4 out_data5;
layout(location = 6) out vec4 out_data6;

in vec2 TexCoord;

uniform vec3 uniform_bbox_min;
uniform vec3 uniform_bbox_max;
uniform sampler3D sampler_points[7];
uniform ivec3 uniform_resolution;
uniform vec3 uniform_stratum;
uniform float uniform_occlusion_res_z;
uniform usampler2D sampler_occlusion;
uniform int uniform_num_samples;
uniform vec3 uniform_samples_3d_sphere[200];
uniform float uniform_average_albedo;

flat in int vCurrentLayer;

// implementation based on: lumina.sourceforge.net/Tutorials/Noise.html
// Fast random number generator
float rand(vec2 co)
{
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
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

vec3 dotSH (in vec3 direction, in vec3 L00,
				 in vec3 L1_1, in vec3 L10, in vec3 L11,
				 in vec3 L2_2, in vec3 L2_1, in vec3 L20, in vec3 L21, in vec3 L22 )
{
	// cosine lobe in SH
	float Y00  = 0.886226925;
	float Y1_1 = -1.02332671 * direction.y;
	float Y10  = 1.02332671 * direction.z;
	float Y11  = -1.02332671 * direction.x;
	float Y2_2 = 0.858086 * direction.x * direction.y;
	float Y2_1 = -0.858086 * direction.y * direction.z;
	float Y20  = 0.743125 * direction.z * direction.z - 0.247708;
	float Y21  = -0.858086 * direction.x * direction.z;
	float Y22  = 0.429043 * (direction.x * direction.x - direction.y * direction.y);

	// dot product in SH, return reconstructed irradiance
	vec3 irradiance = vec3(0);
#if defined (NOCOMPRESSION) || defined(CONVERSION)
		irradiance = Y00*L00 + Y1_1*L1_1 + Y10*L10 + Y11*L11 + Y2_2*L2_2 + Y2_1*L2_1 + Y20*L20 + Y21*L21 + Y22*L22;
#elif defined(LOW_COMPRESSION)
		irradiance = Y00*L00 + Y1_1*L1_1 + Y10*L10 + Y11*L11;
		irradiance.x += Y2_2*L2_2.x + Y2_1*L2_1.x + Y20*L20.x + Y21*L21.x + Y22*L22.x;
#elif defined(HIGH_COMPRESSION)
		irradiance = Y00*L00;
		irradiance.x += Y1_1*L1_1.x + Y10*L10.x + Y11*L11.x + Y2_2*L2_2.x + Y2_1*L2_1.x + Y20*L20.x + Y21*L21.x + Y22*L22.x;
#endif // COMPRESSION
	return irradiance;
}

vec3 SHReconstruction (in vec3 dir, in vec3 L00,
				 in vec3 L1_1, in vec3 L10, in vec3 L11,
				 in vec3 L2_2, in vec3 L2_1, in vec3 L20, in vec3 L21, in vec3 L22 )
{
	float sh00, sh1_1, sh10, sh11, sh2_2, sh2_1, sh20, sh21, sh22;
	projectDirToOrder2Basis ( dir, sh00, sh1_1, sh10, sh11, sh2_2, sh2_1, sh20, sh21, sh22 );

	// reconstruct function by summing SH coefficients with projected basis functions
	vec3 reconstructed_value = vec3(0);
#if defined (NOCOMPRESSION) || defined(CONVERSION)
		reconstructed_value = sh00*L00 + sh1_1*L1_1 + sh10*L10 + sh11*L11 + sh2_2*L2_2 + sh2_1*L2_1 + sh20*L20 + sh21*L21 + sh22*L22;
#elif defined(LOW_COMPRESSION)
		reconstructed_value = sh00*L00 + sh1_1*L1_1 + sh10*L10 + sh11*L11;
		reconstructed_value.x += sh2_2*L2_2.x + sh2_1*L2_1.x + sh20*L20.x + sh21*L21.x + sh22*L22.x;
#elif defined(HIGH_COMPRESSION)
		reconstructed_value = sh00*L00;
		reconstructed_value.x += sh1_1*L1_1.x + sh10*L10.x + sh11*L11.x + sh2_2*L2_2.x + sh2_1*L2_1.x + sh20*L20.x + sh21*L21.x + sh22*L22.x;
#endif // COMPRESSION
	return reconstructed_value;
}

void main(void)
{
	vec3  SH_00		= vec3(0.0,0.0,0.0);
	vec3  SH_1_1	= vec3(0.0,0.0,0.0);
	vec3  SH_10		= vec3(0.0,0.0,0.0); 
	vec3  SH_11		= vec3(0.0,0.0,0.0);
	vec3  SH_2_2	= vec3(0.0,0.0,0.0);
	vec3  SH_2_1	= vec3(0.0,0.0,0.0);
	vec3  SH_20		= vec3(0.0,0.0,0.0);
	vec3  SH_21		= vec3(0.0,0.0,0.0); 
	vec3  SH_22		= vec3(0.0,0.0,0.0);
	
	// gl_FragCoord returns the coordinates at the center of the pixel (0.5, 0.5)
	vec3 voxel_coord = vec3(gl_FragCoord.xy, vCurrentLayer + 0.5);

	// check for unoccupied CRC voxel and skip (occupied voxels have 1.0 alpha)	
	float occupancy_flag = 0.0;
#if defined (NOCOMPRESSION) || defined(CONVERSION)
		occupancy_flag = texelFetch(sampler_points[6], ivec3(voxel_coord), 0).a;
#elif defined(LOW_COMPRESSION)
		occupancy_flag = texelFetch(sampler_points[4], ivec3(voxel_coord), 0).b;
#elif defined(HIGH_COMPRESSION)
		occupancy_flag = texelFetch(sampler_points[2], ivec3(voxel_coord), 0).a;
#endif // COMPRESSION
	if (occupancy_flag < 1.0) discard;

	vec3 extents = uniform_bbox_max - uniform_bbox_min;
	vec3 normalized_extents = extents / max (extents.x, max(extents.y,extents.z) );
	// position is initialized at the center of the current voxel
	vec3 pos_wcs = uniform_bbox_min + vec3(voxel_coord) * uniform_stratum;

	float dist;
	vec3 uvw = (pos_wcs - uniform_bbox_min) / extents;

	float stratum_length = length(uniform_stratum);
	float surface_radius = stratum_length * 0.5;
	
	float favg = 0;
	float occ_vox = 0.0;
	
	vec3 L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22;
	vec4 data0, data1, data2, data3, data4, data5, data6;

	for (int i = 0; i < uniform_num_samples; i++)
	{
		vec3 uvw_dir = normalize(uniform_samples_3d_sphere[i] / normalized_extents);
		
#ifndef OCCLUSION
		bool hit = true;
		vec3 final_sample_pos = (uvw + uvw_dir) * MAX_PARAMETRIC_DIST;
		ivec3 isample_voxel = ivec3(final_sample_pos * uniform_resolution);
#else //OCCLUSION

		// parametric space ray marching
		bool hit = false;
		ivec3 isample_voxel = ivec3(0,0,0);

		// skip one voxel
		vec3 offset = 0.5/vec3(uniform_resolution);

		int random_seed = int(rand(TexCoord.xy) * uniform_num_samples);
		vec3 random_rot = uniform_samples_3d_sphere[random_seed] * 0.5 + 0.5;

		float constant_offset = length(offset + (random_rot.x /vec3(uniform_resolution)));

		vec3 start_pos = uvw + uvw_dir * constant_offset;
		vec3 final_sample_pos = start_pos;
		vec3 sample_step = uvw_dir * MAX_PARAMETRIC_DIST / float(NUM_OCCLUSION_SAMPLES);

		for (int j = 0; j <= NUM_OCCLUSION_SAMPLES; j++)
		{
			vec3 sample_pos = start_pos + j * sample_step;
					
			uvec4 slice = textureLod(sampler_occlusion, sample_pos.xy, 0);
			uint voxel_z = uint(uniform_occlusion_res_z - floor((sample_pos.z * uniform_occlusion_res_z) + 0.0) - 1);

			// get an unsigned vec4 containing the current position (marked as 1)
			uvec4 slicePos = uvec4(0u,0u,0u,0u);
			slicePos[voxel_z / 32u] = 1u << (voxel_z % 32u);

			// use AND to mark whether the current position has been set as occupied
			uvec4 res = slice & slicePos;

			// check if the current position is marked as occupied
			hit = hit || ((res.r | res.g | res.b | res.a) > 0u); 
			
			isample_voxel = (hit)? ivec3(sample_pos*uniform_resolution) : isample_voxel;
			final_sample_pos = (hit)? sample_pos : final_sample_pos;
			j = (hit)? NUM_OCCLUSION_SAMPLES : j;
		}
#endif
		vec3 sample_pos_wcs = uniform_bbox_min + vec3(isample_voxel + 0.5) * uniform_stratum;
		vec3 dir = sample_pos_wcs - pos_wcs;
		
		if (!hit || dot(dir, dir) < stratum_length * stratum_length)
			continue;

		occ_vox += 1;

		//float surface_area = surface_radius * surface_radius * 3.14159;
		// simplified: 
		//float surface_area = surface_radius * surface_radius;
		
		// simplified: pi / pi^2
		//vec3 GI = uniform_average_albedo * color * visibility * surface_area  / (3.14159* (0.01 + dist*dist) );
		//vec3 GI = color;// / (3.14159* (0.01 + dist*dist) );
		//color = clamp(color, vec3(0), vec3(1));
		//float dist = length(dir);
		dir = normalize(dir);

		//uint debug_counter_uint3 = atomicCounterIncrement(debug_atomic_counter3);
		vec3 L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22;
#if defined (NOCOMPRESSION) || defined(CONVERSION)
			vec4 data0		= texture(sampler_points[0], final_sample_pos);	
			vec4 data1		= texture(sampler_points[1], final_sample_pos);
			vec4 data2		= texture(sampler_points[2], final_sample_pos);
			vec4 data3		= texture(sampler_points[3], final_sample_pos);
			vec4 data4		= texture(sampler_points[4], final_sample_pos);
			vec4 data5		= texture(sampler_points[5], final_sample_pos);
			vec4 data6		= texture(sampler_points[6], final_sample_pos);
			L00				= vec3(data0.x, data0.y, data0.z);
			L1_1			= vec3(data0.w, data1.x, data1.y);
			L10				= vec3(data1.z, data1.w, data2.x);
			L11				= vec3(data2.y, data2.z, data2.w);
			L2_2			= vec3(data3.x, data3.y, data3.z);
			L2_1			= vec3(data3.w, data4.x, data4.y);
			L20				= vec3(data4.z, data4.w, data5.x);
			L21				= vec3(data5.y, data5.z, data5.w);
			L22				= vec3(data6.x, data6.y, data6.z);
#elif defined(LOW_COMPRESSION)
			vec4 data0		= texture(sampler_points[0], final_sample_pos);	
			vec4 data1		= texture(sampler_points[1], final_sample_pos);
			vec4 data2		= texture(sampler_points[2], final_sample_pos);
			vec4 data3		= texture(sampler_points[3], final_sample_pos);
			vec4 data4		= texture(sampler_points[4], final_sample_pos);
			L00				= vec3(data0.x, data0.y, data0.z);
			L1_1			= vec3(data0.w, data1.x, data1.y);
			L10				= vec3(data1.z, data1.w, data2.x);
			L11				= vec3(data2.y, data2.z, data2.w);
			L2_2			= vec3(data3.x, 0.0, 0.0);
			L2_1			= vec3(data3.y, 0.0, 0.0);
			L20				= vec3(data3.z, 0.0, 0.0);
			L21				= vec3(data3.w, 0.0, 0.0);
			L22				= vec3(data4.x, 0.0, 0.0);
#elif defined(HIGH_COMPRESSION)
			vec4 data0		= texture(sampler_points[0], final_sample_pos);	
			vec4 data1		= texture(sampler_points[1], final_sample_pos);
			vec4 data2		= texture(sampler_points[2], final_sample_pos);
			L00				= vec3(data0.x, data0.y, data0.z);
			L1_1			= vec3(data0.w, 0.0, 0.0);
			L10				= vec3(data1.x, 0.0, 0.0);
			L11				= vec3(data1.y, 0.0, 0.0);
			L2_2			= vec3(data1.z, 0.0, 0.0);
			L2_1			= vec3(data1.w, 0.0, 0.0);
			L20				= vec3(data2.x, 0.0, 0.0);
			L21				= vec3(data2.y, 0.0, 0.0);
			L22				= vec3(data2.z, 0.0, 0.0);
#endif // COMPRESSION	
		// calculate the hemispherical integral using SH dot product
		vec3 sample_irradiance = dotSH (-dir, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
		encodeRadianceToSH (dir, sample_irradiance, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);	
				
		SH_00  += L00;
		SH_1_1 += L1_1; 
		SH_10  += L10;
		SH_11  += L11;
		SH_2_2 += L2_2; 
		SH_2_1 += L2_1; 
		SH_20  += L20;
		SH_21  += L21;
		SH_22  += L22;
	}

	float mult = 4.0 * uniform_average_albedo / float( 1 + occ_vox );
	
#ifdef INC_BOUNCE 
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
			out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1)		* mult;
			out_data1			= vec4 (SH_10.r,	SH_11.r,	SH_2_2.r,	SH_2_1.r)	* mult;
			out_data2.rgb		= vec3 (SH_20.r,	SH_21.r,	SH_22.r)				* mult;
			out_data2.a			= 1.0;
	#endif // COMPRESSION
#else
	#if defined (NOCOMPRESSION) || defined(CONVERSION)
			out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1.r)	* mult + texture(sampler_points[0],uvw);
			out_data1			= vec4 (SH_1_1.g,	SH_1_1.b,	SH_10.r,	SH_10.g)	* mult + texture(sampler_points[1],uvw);
			out_data2			= vec4 (SH_10.b,	SH_11.r,	SH_11.g,	SH_11.b)	* mult + texture(sampler_points[2],uvw);
			out_data3			= vec4 (SH_2_2.r,	SH_2_2.g,	SH_2_2.b,	SH_2_1.r)	* mult + texture(sampler_points[3],uvw);
			out_data4			= vec4 (SH_2_1.g,	SH_2_1.b,	SH_20.r,	SH_20.g)	* mult + texture(sampler_points[4],uvw);
			out_data5			= vec4 (SH_20.b,	SH_21.r,	SH_21.g,	SH_21.b)	* mult + texture(sampler_points[5],uvw);
			out_data6.rgb		= vec3 (SH_22.r,	SH_22.g,	SH_22.b)				* mult + texture(sampler_points[6],uvw).rgb;
			out_data6.a			= 1.0;
	#elif defined(LOW_COMPRESSION)
			// compressing CoCg to 2nd order
			out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1.r)	* mult + texture(sampler_points[0],uvw);
			out_data1			= vec4 (SH_1_1.g,	SH_1_1.b,	SH_10.r,	SH_10.g)	* mult + texture(sampler_points[1],uvw);
			out_data2			= vec4 (SH_10.b,	SH_11.r,	SH_11.g,	SH_11.b)	* mult + texture(sampler_points[2],uvw);
			out_data3			= vec4 (SH_2_2.r,	SH_2_1.r,	SH_20.r,	SH_21.r)	* mult + texture(sampler_points[3],uvw);
			out_data4.r			= SH_22.r * mult + texture(sampler_points[4],uvw).r;
			out_data4.b			= 1.0;
	#elif defined(HIGH_COMPRESSION)
			// compressing CoCg to 1st order
			out_data0			= vec4 (SH_00.r,	SH_00.g,	SH_00.b,	SH_1_1)		* mult + texture(sampler_points[0],uvw);
			out_data1			= vec4 (SH_10.r,	SH_11.r,	SH_2_2.r,	SH_2_1.r)	* mult + texture(sampler_points[1],uvw);
			out_data2.rgb		= vec3 (SH_20.r,	SH_21.r,	SH_22.r)				* mult + texture(sampler_points[2],uvw).rgb;
			out_data2.a			= 1.0;
	#endif // COMPRESSION
#endif
}
