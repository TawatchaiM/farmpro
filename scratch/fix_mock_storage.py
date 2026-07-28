import re

with open('d:/Workspace/Project/FarmPro/src/supabase.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add getMockProfileKey and mock profile removal to seedMockData
# Find 'const seedMockData = () => {' and insert logic.

seed_replacement = '''
// Helper to get correct mock profile key based on role
export const getMockProfileKey = () => {
  const role = localStorage.getItem('farmpro_current_role') || 'BUYER';
  return role === 'SELLER' ? 'farmpro_mock_seller' : 'farmpro_mock_buyer';
};

const seedMockData = () => {
  // Clear old cache keys to prevent data contamination
  localStorage.removeItem('farmpro_user_profile');
  localStorage.removeItem('farmpro_profile');
  
  // Seed Mock Profiles for separate roles
  if (!localStorage.getItem('farmpro_mock_buyer')) {
    localStorage.setItem('farmpro_mock_buyer', JSON.stringify({
      id: 'mock-buyer-id',
      user_id: 'mock-buyer-id',
      full_name: '?????? ??????????',
      phone_number: '0811111111',
      role: 'buyer',
      store_name: '????????????????'
    }));
  }
  if (!localStorage.getItem('farmpro_mock_seller')) {
    localStorage.setItem('farmpro_mock_seller', JSON.stringify({
      id: 'mock-seller-id',
      user_id: 'mock-seller-id',
      full_name: '???? ??????',
      phone_number: '0822222222',
      role: 'seller'
    }));
  }
'''
content = content.replace('const seedMockData = () => {', seed_replacement, 1)

# 2. Replace 'farmpro_profile' in getters and updaters with getMockProfileKey()
content = content.replace("'farmpro_profile'", "getMockProfileKey()")
content = content.replace('"farmpro_profile"', "getMockProfileKey()")

# 3. Fix signIn: It needs to set the role correctly before saving the profile
sign_in_pattern = r"(localStorage\.setItem\(getMockProfileKey\(\), JSON\.stringify\(profileToUse\)\);)"
sign_in_replacement = r"localStorage.setItem('farmpro_current_role', profileToUse.role === 'seller' ? 'SELLER' : 'BUYER');\n      \1"
content = re.sub(sign_in_pattern, sign_in_replacement, content)

# 4. Fix signOut: it needs to remove both mock profiles and current role
sign_out_pattern = r"(localStorage\.removeItem\(getMockProfileKey\(\)\);)"
sign_out_replacement = r"localStorage.removeItem('farmpro_mock_buyer');\n    localStorage.removeItem('farmpro_mock_seller');\n    localStorage.removeItem('farmpro_current_role');"
content = re.sub(sign_out_pattern, sign_out_replacement, content)

with open('d:/Workspace/Project/FarmPro/src/supabase.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated supabase.js successfully!")
