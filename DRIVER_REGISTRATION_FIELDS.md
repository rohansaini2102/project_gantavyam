# Driver Registration Form - Field Documentation

## Form Structure Overview

The driver registration form is divided into **4 steps** with real-time validation and database checks.

---

## Step 1: Personal Information

| Field Name | Type | Required | Database Check | Validation Rules |
|------------|------|----------|----------------|------------------|
| **Full Name** | Text | ✅ Yes | ❌ No | • Min 2 chars<br>• Max 100 chars<br>• Only letters, spaces, dots, apostrophes, hyphens<br>• Must have first + last name<br>• No numbers allowed |
| **Mobile Number** | Tel | ✅ Yes | ✅ Yes | • Exactly 10 digits<br>• Must start with 6, 7, 8, or 9<br>• **Database Check**: Driver.mobileNo + User.phone<br>• Pattern validation against common invalid numbers |
| **Email Address** | Email | ✅ Yes | ✅ Yes | • Valid email format<br>• Max 100 chars<br>• **Database Check**: Driver.email + User.email<br>• No disposable email domains |
| **Aadhaar Number** | Text | ✅ Yes | ✅ Yes | • Exactly 12 digits<br>• **Database Check**: Driver.aadhaarNo<br>• Checksum validation<br>• No fake patterns (000000000000, etc.) |
| **Vehicle Number** | Text | ✅ Yes | ✅ Yes | • Format: STATE+DISTRICT+SERIES+NUMBER<br>• **Database Check**: Driver.vehicleNo<br>• Valid Indian state codes<br>• Auto-uppercase transform |
| **Aadhaar Photo (Front)** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |
| **Aadhaar Photo (Back)** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |
| **Live Photo (Selfie)** | Camera | ✅ Yes | ❌ No | • Camera capture<br>• File size validation |
| **RC Photo** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |

---

## Step 2: Bank Details

| Field Name | Type | Required | Database Check | Validation Rules |
|------------|------|----------|----------------|------------------|
| **Bank Name** | Text | ✅ Yes | ❌ No | • Min 2 chars<br>• Max 100 chars<br>• Must contain "bank", "cooperative", "credit", or "finance" |
| **IFSC Code** | Text | ✅ Yes | ❌ No | • Exactly 11 characters<br>• Format: 4 letters + 0 + 6 alphanumeric<br>• Valid bank codes (SBIN, HDFC, etc.)<br>• Auto-uppercase transform |
| **Account Number** | Text | ✅ Yes | ❌ No | • 9-18 digits only<br>• No fake patterns (000000000, 123456789, etc.) |
| **Account Holder Name** | Text | ✅ Yes | ❌ No | • Min 2 chars<br>• Max 100 chars<br>• Only letters, spaces, dots, apostrophes, hyphens |

---

## Step 3: Licenses & Certificates

| Field Name | Type | Required | Database Check | Validation Rules |
|------------|------|----------|----------------|------------------|
| **Driving License Number** | Text | ✅ Yes | ✅ Yes | • Min 8 chars, Max 20 chars<br>• **Database Check**: Driver.drivingLicenseNo<br>• Valid state code validation<br>• Auto-uppercase transform |
| **DL Photo** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |
| **Permit Number** | Text | ✅ Yes | ❌ No | • Min 5 chars, Max 30 chars<br>• Auto-uppercase transform |
| **Permit Photo** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |
| **Fitness Certificate Number** | Text | ✅ Yes | ❌ No | • Min 5 chars, Max 30 chars<br>• Auto-uppercase transform |
| **Fitness Certificate Photo** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |
| **Insurance Policy Number** | Text | ✅ Yes | ❌ No | • Min 8 chars, Max 30 chars<br>• Auto-uppercase transform |
| **Insurance Policy Photo** | File | ✅ Yes | ❌ No | • JPG, JPEG, PNG only<br>• Max 5MB, Min 10KB |

---

## Step 4: Security

| Field Name | Type | Required | Database Check | Validation Rules |
|------------|------|----------|----------------|------------------|
| **Password** | Password | ✅ Yes | ❌ No | • Min 8 chars, Max 128 chars<br>• Must include: uppercase, lowercase, number, special char<br>• No weak passwords (password, 12345678, etc.)<br>• No 3+ consecutive identical chars |
| **Confirm Password** | Password | ✅ Yes | ❌ No | • Must match password exactly |

---

## Database Validation Details

### Fields Checked Against Database:
1. **Mobile Number** → Checks `Driver.mobileNo` AND `User.phone`
2. **Email Address** → Checks `Driver.email` AND `User.email`
3. **Aadhaar Number** → Checks `Driver.aadhaarNo` only
4. **Vehicle Number** → Checks `Driver.vehicleNo` only
5. **Driving License Number** → Checks `Driver.drivingLicenseNo` only

### API Endpoint:
```
POST /api/admin/validate/:field
Authorization: Bearer <adminToken>
Body: { "value": "fieldValue" }
```

### Response Format:
```json
{
  "isUnique": true/false,
  "isValid": true/false,
  "message": "Status message",
  "field": "fieldName"
}
```

---

## Real-Time Validation Features

### ✅ Implemented:
- **Debounced input validation** (300ms delay)
- **Loading indicators** during API calls
- **Caching** to avoid duplicate API calls
- **Toast notifications** for validation results
- **Visual feedback**: Red borders for errors, green for valid
- **Step progression blocking** until current step is valid
- **Detailed error messages** with suggestions
- **Auto-save functionality** to prevent data loss

### 🔄 Validation Flow:
1. **User types** → Debounced handler triggers
2. **Format validation** → Yup schema validation
3. **API validation** → Database uniqueness check (if applicable)
4. **Visual feedback** → Colors, icons, messages update
5. **Step validation** → Enables/disables next button

---

## Test Data for Validation

### Existing Records (Should Show as "Already Registered"):
- **Mobile**: 9876543210, 8765432109, 7654321098, 6543210987
- **Email**: test1@example.com, test2@example.com, user1@example.com, user2@example.com
- **Aadhaar**: 123456789012, 987654321098
- **Vehicle**: MH01AB1234, DL02CD5678
- **License**: MH0120110012345, DL0320150098765

### New Values (Should Show as "Available"):
- **Mobile**: 9123456789, 8123456789
- **Email**: newdriver@example.com, fresh@test.com
- **Aadhaar**: 555666777888, 111222333444
- **Vehicle**: UP01XY9999, KA02AB5678
- **License**: UP0120230012345, KA0320240098765