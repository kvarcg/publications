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
layout(location = 0) out vec2 out_normal;
layout(location = 1) out vec4 out_lighting;
in vec4 pwcs;
in vec4 pecs;
in vec3 Necs;
in vec3 Tecs;
in vec3 Becs;
in vec4[2] TexCoord;
in vec4 color;

uniform sampler2D sampler_tex_color;
uniform sampler2D sampler_bump;

uniform vec3 uniform_view_position;
uniform vec4 uniform_material_color;
uniform uint uniform_texture_mask;
uniform mat4 uniform_light_view;
uniform vec3 uniform_light_color;
uniform vec3 light_direction;
uniform int uniform_resolution;
uniform float uniform_light_size;

vec2 normal_encode_xy(vec3 normal)
{
	return vec2(0.5+normal.xy*0.5);
}

vec2 normal_encode_spheremap1(vec3 normal)
{
	float f = sqrt(8*normal.z+8);
    return normal.xy / f + 0.5;
}

vec2 normal_encode_spheremap2(vec3 normal)
{
	vec2 enc = normalize(normal.xy) * (sqrt(-normal.z*0.5+0.5));
    enc = enc*0.5+0.5;
    return enc;
}

void main(void)
{
	//if( pecs.z > 0.0f ) discard;
	uint hastex  = (uniform_texture_mask & 0x01u) >> 0u;
	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;

	vec4 tex_color = vec4(1,1,1,1);
	if (hastex > 0u)
		tex_color = texture2D(sampler_tex_color, TexCoord[0].st);
			
	if (tex_color.a < 0.5)
		discard;

	vec4 kd = uniform_material_color * color * tex_color;
	
	// normal
	vec3 newN = Necs;
	if (hasbump > 0u)
	{
		vec4 nmap = texture2D(sampler_bump, TexCoord[0].st);
		float heigh_prev_U = textureOffset(sampler_bump, TexCoord[0].st,ivec2(-1,0)).r;
		float heigh_prev_V = textureOffset(sampler_bump, TexCoord[0].st,ivec2(0,-1)).r;
		newN+= -2.0*(Tecs*(nmap.r-heigh_prev_U) + Becs*(nmap.r-heigh_prev_V));
	}
	newN = normalize(newN);
	out_normal = normal_encode_spheremap1(newN);
	
	// calculate flux 
	vec3 vertex_to_light_direction_ecs = -normalize(pecs.xyz);
	
	float ndotl = max(0.0, dot(newN, vertex_to_light_direction_ecs.xyz));

	vec3 dirColor = kd.rgb * uniform_light_color.rgb * ndotl;
	
	// convert half the angle to radians
	float tan_phi_2 = tan (3.14159 * 180 / 360.0);
	float sqr_tan_phi_2 = tan_phi_2 * tan_phi_2;
		
	//vec3 radiosity = kd.rgb * uniform_light_color.rgb * ndotl / (3.14159 * ( dot(pecs,pecs) - uniform_light_size*uniform_light_size ) );
	// simplified:
	vec3 radiosity = kd.rgb * uniform_light_color.rgb / (3.14159 );   
	float A_texel = 4.0 * sqr_tan_phi_2 /( float(uniform_resolution) * float(uniform_resolution) );
	vec2 o = (tan_phi_2/float(uniform_resolution)) * vec2(1.0 + 2 * gl_FragCoord.x - uniform_resolution, 1.0 + 2 * gl_FragCoord.y - uniform_resolution);
	float d_ij = sqrt(dot(o,o) + 1);
	//float A = dot(pecs,pecs) * A_texel / (d_ij * d_ij * d_ij * (0.01+ndotl));
	//simplified:
	float A =  A_texel / (d_ij * d_ij * d_ij );
		
	// X100 for storage and encoding precision rectification
	out_lighting = vec4( (100.0*A)* radiosity, 1.0);
}
