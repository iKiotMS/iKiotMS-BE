# Integration Tests

Integration tests để kiểm tra subscription middleware và quota enforcement trên các endpoints tạo resource.

## Cấu trúc

```
__tests__/
  setup.js              # Test setup configuration
  integration/
    staff.test.js       # Staff creation tests với user quota
    branch.test.js      # Branch creation tests với branch quota
    product.test.js     # Product creation tests với product quota
```

## Tests được bao gồm

### Staff Tests

- ✓ Trial plan: Tạo staff ≤ 2 users - thành công
- ✓ Trial plan: Tạo staff thứ 3 - lỗi quota
- ✓ Plus plan: Tạo staff ≤ 5 users - thành công
- ✓ Pro plan: Tạo unlimited staff - thành công
- ✓ No subscription: Từ chối truy cập
- ✓ Expired subscription: Từ chối truy cập

### Branch Tests

- ✓ Trial plan: Tạo branch ≤ 2 - thành công
- ✓ Trial plan: Tạo branch thứ 3 - lỗi quota
- ✓ Plus plan: Tạo branch ≤ 3 - thành công
- ✓ Pro plan: Tạo unlimited branches - thành công

### Product Tests

- ✓ Trial plan: Tạo product ≤ 100 - thành công
- ✓ Trial plan: Tạo product thứ 101 - lỗi quota
- ✓ Plus plan: Tạo product ≤ 1000 - thành công
- ✓ Pro plan: Tạo unlimited products - thành công
- ✓ No subscription: Từ chối truy cập

## Prerequisites

1. MongoDB chạy trên `localhost:27017` (hoặc set `CONNECTION_STRING` trong `.env.test`)
2. Node.js devDependencies cài đặt:
   ```bash
   npm install --save-dev jest supertest
   ```

## Chạy tests

```bash
# Chạy tất cả tests
npm test

# Chạy tests với watch mode
npm run test:watch

# Chạy tests với coverage report
npm run test:coverage

# Chạy một test file cụ thể
npm test -- __tests__/integration/staff.test.js
```

## Kỳ vọng

**Trước khi chạy tests:**

- Cần MongoDB instance chạy
- `.env.test` file phải tồn tại
- Seed plan data: `npm run seed:plans`

**Tests sẽ:**

1. Tạo databases tạm thời cho mỗi test
2. Seed 3 plans (TRIAL, PLUS, PRO)
3. Tạo test tenant + user + subscription
4. Test các endpoints với khác nhau quota limits
5. Clean up sau khi hoàn thành

## Mở rộng

Để thêm tests cho các module khác:

1. Tạo file `__tests__/integration/module.test.js`
2. Copy helper functions từ `staff.test.js`
3. Viết test cases cho quota logic
