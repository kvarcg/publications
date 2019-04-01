// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the reconstruction stage

#version 330 core

#define __COMPRESSION_METHOD__

layout(location = 0) out vec4 out_color;
in vec2 TexCoord;

uniform sampler3D sampler_points[7];
uniform sampler2D sampler_depth;
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_normal;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_ssao;
uniform mat4 uniform_view_projection_inv;
uniform mat4 uniform_view_inv;
uniform float uniform_factor;
uniform vec3 uniform_bbox_min;
uniform vec3 uniform_bbox_max;
uniform float uniform_bbox_min_side;
uniform vec3 uniform_stratum;
uniform vec3 uniform_user_ambient_color;
uniform int uniform_use_ao;
uniform int uniform_moving_mode;
uniform float uniform_saturation;

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

vec3 VectorECS2WCS(in vec3 v_ecs)
{
	vec4 v_wcs = uniform_view_inv * vec4(v_ecs,0);
	return v_wcs.xyz;
}

vec3 PointCSS2WCS(in vec3 p_ccs)
{
	vec4 p_wcs = uniform_view_projection_inv * vec4(p_ccs,1.0);
	return p_wcs.xyz/p_wcs.w;
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

vec3 RGB2YCoCg(vec3 rgbColor)
{
	return vec3(
	 rgbColor.r * 0.25 + rgbColor.g * 0.5 + rgbColor.b * 0.25,
	 rgbColor.r * 0.5 					  - rgbColor.b * 0.5,
	-rgbColor.r * 0.25 + rgbColor.g * 0.5 - rgbColor.b * 0.25
	);
}

vec3 YCoCg2RGB(vec3 YCoCg)
{
	return vec3(
	YCoCg.r + YCoCg.g - YCoCg.b,
	YCoCg.r			  + YCoCg.b,
	YCoCg.r - YCoCg.g - YCoCg.b
	);
}

vec3 normal_unpack_xy(vec3 pixel)
{
	return normalize(vec3(pixel.rg * 2.0 - 1.0, pixel.b));
}

void main(void)
{
	vec3 gi_diffuse_color = vec3(0.0,0.0,0.0);
	float depth = texture(sampler_depth, TexCoord.st).r;
	
	vec3 normal_wcs;
	vec3 pos_css;
	vec3 pos_wcs;
	if (depth==1.0)
	{
		discard;
	}
	
	float blending = 1.0;
	vec3 extents = uniform_bbox_max - uniform_bbox_min;

	vec3 sz = textureSize(sampler_points[0],0);
	pos_css = vec3(2.0*vec3(TexCoord.xy, depth)-1.0);
	pos_wcs = PointCSS2WCS(pos_css);
	
	vec3 uvw = (pos_wcs - uniform_bbox_min) / extents;

	vec3 normal_ecs = normal_decode_spheremap1(texture2D(sampler_normal,TexCoord.st).xy);
	normal_ecs = normalize(normal_ecs);
	normal_wcs = normalize(VectorECS2WCS(normal_ecs));

	vec3 normalized_extents = extents / max (extents.x, max(extents.y,extents.z) );
	
	vec3 v_rand = vec3(0.5, 0.5, 0.5);
	vec3 v_1 = normalize(cross(normal_wcs,v_rand));
	vec3 v_2 = cross(normal_wcs,v_1);
			
	vec3 D[4];
	D[0] = vec3(0.1,0.0,0.0);

	for (int i = 1; i < 4; i++)
	{
		D[i] = vec3(0.1, 0.3*cos((i) * 6.2832/3.0), 0.3*sin((i) * 6.2832/3.0));
		D[i] = normalize(D[i] / normalized_extents);
	}

	int total = 0;
	for (int i = 0; i < 4; i++)
	{
		vec3 sdir = normal_wcs * D[i].x + v_1 * D[i].y + v_2 * D[i].z;
		vec3 uvw_new = (0.1*normal_wcs + sdir)/sz + uvw;
		
		vec3 crc_pos = uniform_bbox_min + uvw_new * extents;

		vec3 path = crc_pos - pos_wcs;

		vec3 sample_irradiance = vec3(0);
#ifdef NOCOMPRESSION
			vec4 data0		= texture(sampler_points[0], uvw_new);	
			vec4 data1		= texture(sampler_points[1], uvw_new);
			vec4 data2		= texture(sampler_points[2], uvw_new);
			vec4 data3		= texture(sampler_points[3], uvw_new);
			vec4 data4		= texture(sampler_points[4], uvw_new);
			vec4 data5		= texture(sampler_points[5], uvw_new);
			vec4 data6		= texture(sampler_points[6], uvw_new);
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
			// saturation is set to 1.0 here
			sample_irradiance = uniform_saturation * dotSH (normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
#elif defined(CONVERSION)
			vec4 data0		= texture(sampler_points[0], uvw_new);	
			vec4 data1		= texture(sampler_points[1], uvw_new);
			vec4 data2		= texture(sampler_points[2], uvw_new);
			vec4 data3		= texture(sampler_points[3], uvw_new);
			vec4 data4		= texture(sampler_points[4], uvw_new);
			vec4 data5		= texture(sampler_points[5], uvw_new);
			vec4 data6		= texture(sampler_points[6], uvw_new);
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
			// saturation is set to 1.0 here
			vec3 sample_irradiance_ycocg = dotSH (normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
			sample_irradiance_ycocg.gb *= uniform_saturation;
			sample_irradiance = YCoCg2RGB(sample_irradiance_ycocg);
#elif defined(LOW_COMPRESSION)
			vec4 data0		= texture(sampler_points[0], uvw_new);	
			vec4 data1		= texture(sampler_points[1], uvw_new);
			vec4 data2		= texture(sampler_points[2], uvw_new);
			vec4 data3		= texture(sampler_points[3], uvw_new);
			vec4 data4		= texture(sampler_points[4], uvw_new);
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
			vec3 sample_irradiance_ycocg = dotSH (normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
			sample_irradiance_ycocg.gb *= uniform_saturation;
			sample_irradiance = YCoCg2RGB(sample_irradiance_ycocg);
#elif defined(HIGH_COMPRESSION)
			vec4 data0		= texture(sampler_points[0], uvw_new);	
			vec4 data1		= texture(sampler_points[1], uvw_new);
			vec4 data2		= texture(sampler_points[2], uvw_new);
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
			vec3 sample_irradiance_ycocg = dotSH (normal_wcs, L00, L1_1, L10, L11, L2_2, L2_1, L20, L21, L22);
			sample_irradiance_ycocg.gb *= uniform_saturation;
			sample_irradiance = YCoCg2RGB(sample_irradiance_ycocg);
#endif // COMPRESSION

		gi_diffuse_color += sample_irradiance;
	}

	gi_diffuse_color *= 0.25;

	vec3 kd = texture(sampler_albedo, TexCoord.st).xyz;
	vec3 ks = texture(sampler_specular, TexCoord.st).xyz;
	gi_diffuse_color.xyz *= (1 - ks) * kd / 3.1459; 

	if (uniform_moving_mode > 0)
	{
		// for a moving volume, the final GI color is a blend
		// between the reconstructed irradiance and a constant
		// ambient color
		// blend starts at 4 voxels before the box's minimum side and
		// reaches maximum at 2 voxels before the box's minimum side

		// center of the moving volume in wcs
		vec3 box_center = (uniform_bbox_max + uniform_bbox_min) * 0.5;
		vec3 min_side_blend_start = box_center + uniform_bbox_min_side - uniform_stratum * 2.0;
		vec3 min_side_blend_stop = box_center + uniform_bbox_min_side - uniform_stratum * 0.0;

		// distance of current point from center
		float dist = distance(box_center, pos_wcs);
		// distance of current point from start of blending
		float dist_min = distance(box_center, min_side_blend_start);
		// distance of current point to stop of blending
		float dist_max = distance(box_center, min_side_blend_stop);

		// normalize it
		float dist_norm = (dist - dist_min) / (dist_max - dist_min);
		dist_norm = clamp(dist_norm, 0.0, 1.0);

		// blend
		vec3 ambient = uniform_user_ambient_color * kd.rgb / 3.14159;
		gi_diffuse_color.rgb = mix(gi_diffuse_color.rgb, ambient, dist_norm);
	}

	// if needed, add the AO contribution to reimburse for the missing near-field GI
	float occlusion = 1.0;
	float directional_occlusion = 1.0;
	if (uniform_use_ao > 0) 
	{
		vec4 occ = texture(sampler_ssao, TexCoord.st);
		occlusion = occ.a;
	}
	
	gi_diffuse_color.xyz *= occlusion * occlusion;
	
	gi_diffuse_color = max(gi_diffuse_color, vec3(0));
	out_color = vec4(gi_diffuse_color * uniform_factor, 1);
}
