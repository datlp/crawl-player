# Quy tắc Git Commit & Push (BẮT BUỘC TIẾNG VIỆT)

## 🛑 Quy tắc tự động hóa Git:
- **KHÔNG TỰ ĐỘNG** thực hiện lệnh `git commit` hoặc `git push` lên GitHub sau khi chỉnh sửa code hoặc hoàn thành công việc.
- Chỉ thực hiện `git commit` hoặc `git push` khi người dùng **yêu cầu trực tiếp**.

---

## 📝 Quy tắc Git Commit Message (BẮT BUỘC TIẾNG VIỆT)

TẤT CẢ các Git commit message (bao gồm cả khi được người dùng yêu cầu sinh commit hoặc bấm nút Generate ✨) PHẢI ĐƯỢC VIẾT HOÀN TOÀN BẰNG **TIẾNG VIỆT** theo định dạng Conventional Commits.

### Format:
`<type>(<scope>): <mô tả tổng quan bằng tiếng Việt>`

`<dòng trống>`
`- Frontend:`
`  + <chi tiết task frontend 1 bằng tiếng Việt>`
`  + <chi tiết task frontend 2 bằng tiếng Việt>`
`- Backend:`
`  + <chi tiết task backend 1 bằng tiếng Việt>`
`  + <chi tiết task backend 2 bằng tiếng Việt>`

*(Nếu thay đổi chỉ thuộc 1 phần như Frontend hoặc Backend thì ghi trực tiếp các gạch đầu dòng chi tiết hoặc ghi rõ nhóm tương ứng)*

### Ví dụ mẫu chuẩn:
```text
feat(drawer): nâng cấp cử chỉ và tối ưu hiệu năng bảng chi tiết video

- Frontend:
  + Hỗ trợ vuốt lên từ thanh thông tin dưới cùng để mở chi tiết video từ từ theo ngón tay
  + Hỗ trợ vuốt xuống để đóng bảng chi tiết và vuốt ngang chuyển xem chi tiết video kế tiếp/trước đó
  + Tách bảng chi tiết video thành drawer độc lập ở cấp gốc để loại bỏ hoàn toàn giật lag
  + Khắc phục xung đột cử chỉ vuốt giữa thanh thông tin dưới cùng và trình phát video
  + Cập nhật hiệu ứng chuyển động trượt dọc mượt mà trên nền GPU
- Backend:
  + Tối ưu API adjacent_video lọc đúng theo ngữ cảnh diễn viên, thể loại và sắp xếp
```

### Các type hợp lệ:
- **feat**: Thêm tính năng mới (ví dụ: `feat(player): thêm thao tác vuốt chuyển video`)
- **fix**: Sửa lỗi (ví dụ: `fix(explorer): sửa lỗi chậm khi xem trước video`)
- **refactor**: Tối ưu/cấu trúc lại code (ví dụ: `refactor(backend): tối ưu truy vấn cơ sở dữ liệu`)
- **docs**: Cập nhật tài liệu (ví dụ: `docs: thêm quy định commit bằng tiếng Việt`)
- **style**: Sửa định dạng, CSS (ví dụ: `style(frontend): căn chỉnh lại giao diện nút xem`)
- **perf**: Tối ưu hiệu năng (ví dụ: `perf(stream): giảm độ trễ tải phân đoạn video`)
- **test**: Thêm/sửa test (ví dụ: `test(api): thêm test cho đường dẫn video`)
- **chore**: Cấu hình, thư viện (ví dụ: `chore(deps): cập nhật gói phụ thuộc`)

### Yêu cầu nghiêm ngặt khi người dùng gõ `gitcommit` hoặc yêu cầu commit:
- Khi người dùng chỉ gõ `gitcommit`, `git commit` hoặc bấm yêu cầu commit:
  1. Tự động kiểm tra các file đã thay đổi (`git status`/`git diff`).
  2. Tự động `git add` các file liên quan.
  3. Tự động sinh commit message chi tiết đầy đủ gồm: Tiêu đề Conventional Commits + Danh sách các gạch đầu dòng liệt kê cụ thể từng đầu việc/tính năng/sửa đổi bằng tiếng Việt.
  4. Thực hiện `git commit` và in ra kết quả xác nhận cho người dùng.
- KHÔNG dùng tiếng Anh cho phần mô tả commit.
- Không thêm dấu chấm ở cuối dòng tiêu đề.

