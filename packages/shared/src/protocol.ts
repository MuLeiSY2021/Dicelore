// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 协议版本串（Global Constraints / 接口页 §0、§6）。破坏性变更进位。
export const CLIENT_PROTOCOL = "dicelore.client/1" as const;
export const NOTIFY_PROTOCOL = "dicelore.notify/1" as const;
