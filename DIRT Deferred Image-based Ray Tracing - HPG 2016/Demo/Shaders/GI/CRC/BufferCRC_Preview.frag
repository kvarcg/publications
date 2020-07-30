// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for previewing GI data

#version 330 core

#define __COMPRESSION_METHOD__

#define COLORED_SPHERES
//#define ALL_SPHERES

layout(location = 0) out vec4 out_color;
flat in vec3 crc_position;
flat in ivec3 crc_voxel_position;
in vec3 in_normal_wcs;
in vec3 in_pos_wcs;

uniform sampler3D sampler_points[7];
uniform float uniform_factor;
uniform vec3 uniform_camera_pos_wcs;

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
	float Y2_1 = 0.858086 * direction.y * direction.z;
	float Y20  = 0.743125 * direction.z * direction.z - 0.247708;
	float Y21  = 0.858086 * direction.x * direction.z;
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

vec3 YCoCg2RGB(vec3 YCoCg)
{
	return vec3(
	YCoCg.r + YCoCg.g - YCoCg.b,
	YCoCg.r			  + YCoCg.b,
	YCoCg.r - YCoCg.g - YCoCg.b
	);
}

float directional_lighting_color(vec3 L, vec3 N)
{
	//return max(0.5 * (0.5 + dot(N, L)), 0.0);
	float ndotl = dot(N, L);
	
	return ndotl * ndotl * 1;
}

void main(void)
{		
	// check for unoccupied CRC voxel and skip (occupied voxels have 1.0 alpha)	
	float occupancy_flag = 0.0;
#if defined (NOCOMPRESSION) || defined(CONVERSION)
		occupancy_flag = texelFetch(sampler_points[6], crc_voxel_position, 0).a;
#elif defined(LOW_COMPRESSION)
		occupancy_flag = texelFetch(sampler_points[4], crc_voxel_position, 0).b;
#elif defined(HIGH_COMPRESSION)
		occupancy_flag = texelFetch(sampler_points[2], crc_voxel_position, 0).a;
#endif // COMPRESSION

#ifndef ALL_SPHERES
	if (occupancy_flag < 1.0) discard;
#endif // ALL_SPHERES
		
	vec3 normal_wcs = normalize(in_normal_wcs);
	vec3 irradiance = vec3(0);
#ifdef NOCOMPRESSION
		vec4 data0		= texture(sampler_points[0], crc_position);	
		vec4 data1		= texture(sampler_points[1], crc_position);
		vec4 data2		= texture(sampler_points[2], crc_position);
		vec4 data3		= texture(sampler_points[3], crc_position);
		vec4 data4		= texture(sampler_points[4], crc_position);
		vec4 data5		= texture(sampler_points[5], crc_position);
		vec4 data6		= texture(sampler_points[6], crc_position);
		vec3 L00		= vec3(data0.x, data0.y, data0.z);
		vec3 L1_1		= vec3(data0.w, data1.x, data1.y);
		vec3 L10		= vec3(data1.z, data1.w, data2.x);
		vec3 L11		= vec3(data2.y, data2.z, data2.w);
		vec3 L2_2		= vec3(data3.x, data3.y, data3.z);
		vec3 L2_1		= vec3(data3.w, data4.x, data4.y);
		vec3 L20		= vec3(data4.z, data4.w, data5.x);
		vec3 L21		= vec3(data5.y, data5.z, data5.w);
		vec3 L22		= vec3(data6.x, data6.y, data6.z);
		// calculate the hemispherical integral using SH dot product
		irradiance = dotSH (-normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
#elif defined(CONVERSION)
		vec4 data0		= texture(sampler_points[0], crc_position);	
		vec4 data1		= texture(sampler_points[1], crc_position);
		vec4 data2		= texture(sampler_points[2], crc_position);
		vec4 data3		= texture(sampler_points[3], crc_position);
		vec4 data4		= texture(sampler_points[4], crc_position);
		vec4 data5		= texture(sampler_points[5], crc_position);
		vec4 data6		= texture(sampler_points[6], crc_position);
		vec3 L00		= vec3(data0.x, data0.y, data0.z);
		vec3 L1_1		= vec3(data0.w, data1.x, data1.y);
		vec3 L10		= vec3(data1.z, data1.w, data2.x);
		vec3 L11		= vec3(data2.y, data2.z, data2.w);
		vec3 L2_2		= vec3(data3.x, data3.y, data3.z);
		vec3 L2_1		= vec3(data3.w, data4.x, data4.y);
		vec3 L20		= vec3(data4.z, data4.w, data5.x);
		vec3 L21		= vec3(data5.y, data5.z, data5.w);
		vec3 L22		= vec3(data6.x, data6.y, data6.z);
		// calculate the hemispherical integral using SH dot product
		vec3 irradiance_ycocg = dotSH (-normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
		irradiance = YCoCg2RGB(irradiance_ycocg);
#elif defined(LOW_COMPRESSION)
		vec4 data0		= texture(sampler_points[0], crc_position);	
		vec4 data1		= texture(sampler_points[1], crc_position);
		vec4 data2		= texture(sampler_points[2], crc_position);
		vec4 data3		= texture(sampler_points[3], crc_position);
		vec4 data4		= texture(sampler_points[4], crc_position);
		vec3 L00		= vec3(data0.x, data0.y, data0.z);
		vec3 L1_1		= vec3(data0.w, data1.x, data1.y);
		vec3 L10		= vec3(data1.z, data1.w, data2.x);
		vec3 L11		= vec3(data2.y, data2.z, data2.w);
		vec3 L2_2		= vec3(data3.x, 0.0, 0.0);
		vec3 L2_1		= vec3(data3.y, 0.0, 0.0);
		vec3 L20		= vec3(data3.z, 0.0, 0.0);
		vec3 L21		= vec3(data3.w, 0.0, 0.0);
		vec3 L22		= vec3(data4.x, 0.0, 0.0);
		// calculate the hemispherical integral using SH dot product
		vec3 irradiance_ycocg = dotSH (-normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
		irradiance = YCoCg2RGB(irradiance_ycocg);
#elif defined(HIGH_COMPRESSION)
		vec4 data0		= texture(sampler_points[0], crc_position);	
		vec4 data1		= texture(sampler_points[1], crc_position);
		vec4 data2		= texture(sampler_points[2], crc_position);
		vec3 L00		= vec3(data0.x, data0.y, data0.z);
		vec3 L1_1		= vec3(data0.w, 0.0, 0.0);
		vec3 L10		= vec3(data1.x, 0.0, 0.0);
		vec3 L11		= vec3(data1.y, 0.0, 0.0);
		vec3 L2_2		= vec3(data1.z, 0.0, 0.0);
		vec3 L2_1		= vec3(data1.w, 0.0, 0.0);
		vec3 L20		= vec3(data2.x, 0.0, 0.0);
		vec3 L21		= vec3(data2.y, 0.0, 0.0);
		vec3 L22		= vec3(data2.z, 0.0, 0.0);
		// calculate the hemispherical integral using SH dot product
		vec3 irradiance_ycocg = dotSH (-normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
		irradiance = YCoCg2RGB(irradiance_ycocg);
#endif // COMPRESSION

	irradiance *= uniform_factor;
	
	out_color = vec4(max(irradiance.xyz / 3.14159, vec3(0)), 1.0);
	
	vec3 vertex_to_view_dir = -normalize(uniform_camera_pos_wcs - in_pos_wcs);
	float dist = 1;
	float light = directional_lighting_color(normal_wcs.xyz, vertex_to_view_dir);

#ifdef COLORED_SPHERES
	if(occupancy_flag < 1.0) 
	{
		out_color.rgb = vec3(0.0,0.6,0.8) * light * dist;
		out_color.a = 1;
#ifndef ALL_SPHERES
		discard;
#endif // ALL_SPHERES
	}
	else
		out_color.rgb = vec3(0.8,0.8,0.0) * light * 0.8 * dist;
#endif // COLORED_SPHERES
}
