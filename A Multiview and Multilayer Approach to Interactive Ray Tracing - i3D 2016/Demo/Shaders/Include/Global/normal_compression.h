#line 2
// Various Normal Encoding/Decoding Utilities

// X,Y encoding
// Parameters:
// - normal, the uncompressed normal
// returns a normal representation
vec2 normal_encode_xy(vec3 normal)
{
	return vec2(0.5 + normal.xy * 0.5);
}

// X,Y decoding
// Parameters:
// - normal, the compressed normal
// returns the uncompressed normal
vec3 normal_decode_xy(vec2 normal)
{
	vec3 n;
	n.xy = 2.0 * normal.xy - 1.0;
	n.z = sqrt(1 - dot(normal.xy, normal.xy));
	return n;
}

// Spheremap Encoding based on Lambert Azimuthal Equal - Area projection
// Parameters:
// - normal, the uncompressed normal
// returns a normal representation
// Source: http://aras-p.info/texts/CompactNormalStorage.html
vec2 normal_encode_spheremap1(vec3 normal)
{
	float f = sqrt(8 * normal.z + 8);
	return normal.xy / f + 0.5;
}

// Spheremap Decoding based on Lambert Azimuthal Equal - Area projection
// Parameters:
// - normal, the compressed normal
// returns the uncompressed normal
// Source: http://aras-p.info/texts/CompactNormalStorage.html
vec3 normal_decode_spheremap1(vec2 normal)
{
	vec2 fenc = normal * 4 - 2;
	float f = dot(fenc, fenc);
	float g = sqrt(1 - f / 4);
	vec3 n;
	n.xy = fenc*g;
	n.z = 1 - f / 2;
	return n;
}

// CryEngine 3 Normal Encoding
// Parameters:
// - normal, the uncompressed normal
// returns the compressed normal
// Source: http://www.crytek.com/cryengine/cryengine3/presentations/a-bit-more-deferred---cryengine3
vec2 normal_encode_spheremap2(vec3 normal)
{
	vec2 enc = normalize(normal.xy) * (sqrt(-normal.z*0.5 + 0.5));
	enc = enc*0.5 + 0.5;
	return enc;
}

// CryEngine 3 Normal Decoding
// Parameters:
// - normal, the compressed normal
// returns the uncompressed normal
// Source: http://www.crytek.com/cryengine/cryengine3/presentations/a-bit-more-deferred---cryengine3
vec3 normal_decode_spheremap2(vec2 normal)
{
	vec4 nn = vec4(2 * normal.rg - 1, 1, -1);
	float l = dot(nn.xyz, -nn.xyw);
	nn.z = l;
	nn.xy *= sqrt(l);
	return nn.xyz * 2 + vec3(0, 0, -1);
}
