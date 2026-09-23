
// 部署完成后在网址后面加上这个，获取自建节点和机场聚合节点，/?token=auto或/auto或

let mytoken = 'auto';
let guestToken = ''; //可以随便取，或者uuid生成，https://1024tools.com/uuid
let BotToken = ''; //可以为空，或者@BotFather中输入/start，/newbot，并关注机器人
let ChatID = ''; //可以为空，或者@userinfobot中获取，/start
let TG = 0; //小白勿动， 开发者专用，1 为推送所有的访问信息，0 为不推送订阅转换后端的访问信息与异常访问
let FileName = 'CF-Workers-SUB';
let SUBUpdateTime = 6; //自定义订阅更新时间，单位小时
let total = 99;//TB
let timestamp = 4102329600000;//2099-12-31

//节点链接 + 订阅链接
let MainData = `
https://cfxr.eu.org/getSub
`;

let urls = [];
let subConverter = "SUBAPI.cmliussss.net"; //在线订阅转换后端，目前使用CM的订阅转换功能。支持自建psub 可自行搭建https://github.com/bulianglin/psub
let subConfig = "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini"; //订阅配置文件
let subProtocol = 'https';

export default {
	async fetch(request, env) {
		const userAgentHeader = request.headers.get('User-Agent');
		const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : "null";
		const url = new URL(request.url);
		const token = url.searchParams.get('token');
		mytoken = env.TOKEN || mytoken;
		BotToken = env.TGTOKEN || BotToken;
		ChatID = env.TGID || ChatID;
		TG = env.TG || TG;
		subConverter = env.SUBAPI || subConverter;
		if (subConverter.includes("http://")) {
			subConverter = subConverter.split("//")[1];
			subProtocol = 'http';
		} else {
			subConverter = subConverter.split("//")[1] || subConverter;
		}
		subConfig = env.SUBCONFIG || subConfig;
		FileName = env.SUBNAME || FileName;

		// ===== 功能开关：优先级 KV SETTINGS（控制台页面可改） > 环境变量 > 默认值 =====
		// 控制台单页入口：GET /admin（Tab：概览 / 日志 / 设置），同路径 ?api=health|logs|settings
		// 兼容：GET /health（探活 JSON）、GET /admin/logs（脚本 JSON）
		// DEDUP / ENABLE_LOGS / FILTER_KEYWORDS 默认关；ENABLE_ADMIN / ENABLE_HEALTH 默认开
		const settings = await loadSettings(env);
		const dedupEnabled = resolveFlag(settings, 'DEDUP', env.DEDUP, false);
		const logsEnabled = resolveFlag(settings, 'ENABLE_LOGS', env.ENABLE_LOGS, false);
		const healthEnabled = resolveFlag(settings, 'ENABLE_HEALTH', env.ENABLE_HEALTH, true);
		const adminEnabled = resolveFlag(settings, 'ENABLE_ADMIN', env.ENABLE_ADMIN, true);
		const featureFlags = { dedup: dedupEnabled, logs: logsEnabled, health: healthEnabled, admin: adminEnabled };

		// 单页控制台 + JSON 别名（开关关闭时不拦截，走原逻辑）
		const p = url.pathname;
		if (adminEnabled && (p === '/admin' || p === '/admin/')) {
			return await handleAdmin(request, env, url, featureFlags, settings);
		}
		if (healthEnabled && p === '/health') {
			return await handleHealth(request, env, featureFlags, settings);
		}
		if (adminEnabled && p === '/admin/logs') {
			return await handleAdminLogs(request, env, url);
		}

		const currentDate = new Date();
		currentDate.setHours(0, 0, 0, 0);
		const timeTemp = Math.ceil(currentDate.getTime() / 1000);
		const fakeToken = await MD5MD5(`${mytoken}${timeTemp}`);
		guestToken = env.GUESTTOKEN || env.GUEST || guestToken;
		if (!guestToken) guestToken = await MD5MD5(mytoken);
		const 访客订阅 = guestToken;
		//console.log(`${fakeUserID}\n${fakeHostName}`); // 打印fakeID

		let UD = Math.floor(((timestamp - Date.now()) / timestamp * total * 1099511627776) / 2);
		total = total * 1099511627776;
		let expire = Math.floor(timestamp / 1000);
		SUBUpdateTime = env.SUBUPTIME || SUBUpdateTime;

		if (!([mytoken, fakeToken, 访客订阅].includes(token) || url.pathname == ("/" + mytoken) || url.pathname.includes("/" + mytoken + "?"))) {
			if (TG == 1 && url.pathname !== "/" && url.pathname !== "/favicon.ico") await sendMessage(`#异常访问 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgent}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
			if (env.URL302) return Response.redirect(env.URL302, 302);
			else if (env.URL) return await proxyURL(env.URL, url);
			else return new Response(await nginx(), {
				status: 200,
				headers: {
					'Content-Type': 'text/html; charset=UTF-8',
				},
			});
		} else {
			if (env.KV) {
				await 迁移地址列表(env, 'LINK.txt');
				if (userAgent.includes('mozilla') && !url.search) {
					await sendMessage(`#编辑订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
					return await KV(request, env, 'LINK.txt', 访客订阅);
				} else {
					MainData = await env.KV.get('LINK.txt') || MainData;
				}
			} else {
				MainData = env.LINK || MainData;
				if (env.LINKSUB) urls = await ADD(env.LINKSUB);
			}
			let 重新汇总所有链接 = await ADD(MainData + '\n' + urls.join('\n'));
			let 自建节点 = "";
			let 订阅链接 = "";
			for (let x of 重新汇总所有链接) {
				if (x.toLowerCase().startsWith('http')) {
					订阅链接 += x + '\n';
				} else {
					自建节点 += x + '\n';
				}
			}
			MainData = 自建节点;
			urls = await ADD(订阅链接);
			await sendMessage(`#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);
			const isSubConverterRequest = request.headers.get('subconverter-request') || request.headers.get('subconverter-version') || userAgent.includes('subconverter');
			let 订阅格式 = 'base64';
			if (!(userAgent.includes('null') || isSubConverterRequest || userAgent.includes('nekobox') || userAgent.includes(('CF-Workers-SUB').toLowerCase()))) {
				if (userAgent.includes('sing-box') || userAgent.includes('singbox') || url.searchParams.has('sb') || url.searchParams.has('singbox')) {
					订阅格式 = 'singbox';
				} else if (userAgent.includes('surge') || url.searchParams.has('surge')) {
					订阅格式 = 'surge';
				} else if (userAgent.includes('quantumult') || url.searchParams.has('quanx')) {
					订阅格式 = 'quanx';
				} else if (userAgent.includes('loon') || url.searchParams.has('loon')) {
					订阅格式 = 'loon';
				} else if (userAgent.includes('clash') || userAgent.includes('meta') || userAgent.includes('mihomo') || url.searchParams.has('clash')) {
					订阅格式 = 'clash';
				}
			}

			let subConverterUrl;
			let 订阅转换URL = `${url.origin}/${await MD5MD5(fakeToken)}?token=${fakeToken}`;
			//console.log(订阅转换URL);
			let req_data = MainData;

			let 追加UA = 'v2rayn';
			if (url.searchParams.has('b64') || url.searchParams.has('base64')) 订阅格式 = 'base64';
			else if (url.searchParams.has('clash')) 追加UA = 'clash';
			else if (url.searchParams.has('singbox')) 追加UA = 'singbox';
			else if (url.searchParams.has('surge')) 追加UA = 'surge';
			else if (url.searchParams.has('quanx')) 追加UA = 'Quantumult%20X';
			else if (url.searchParams.has('loon')) 追加UA = 'Loon';

			const 订阅链接数组 = [...new Set(urls)].filter(item => item?.trim?.()); // 去重
			if (订阅链接数组.length > 0) {
				const 请求订阅响应内容 = await getSUB(订阅链接数组, request, 追加UA, userAgentHeader);
				console.log(请求订阅响应内容);
				req_data += 请求订阅响应内容[0].join('\n');
				订阅转换URL += "|" + 请求订阅响应内容[1];
				if (订阅格式 == 'base64' && !isSubConverterRequest && 请求订阅响应内容[1].includes('://')) {
					subConverterUrl = `${subProtocol}://${subConverter}/sub?target=mixed&url=${encodeURIComponent(请求订阅响应内容[1])}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
					try {
						const subConverterResponse = await fetch(subConverterUrl, { headers: { 'User-Agent': 'v2rayN/CF-Workers-SUB  (https://github.com/cmliu/CF-Workers-SUB)' } });
						if (subConverterResponse.ok) {
							const subConverterContent = await subConverterResponse.text();
							req_data += '\n' + atob(subConverterContent);
						}
					} catch (error) {
						console.log('订阅转换请回base64失败，检查订阅转换后端是否正常运行');
					}
				}
			}

			if (env.WARP) 订阅转换URL += "|" + (await ADD(env.WARP)).join("|");
			//修复中文错误
			const utf8Encoder = new TextEncoder();
			const encodedData = utf8Encoder.encode(req_data);
			//const text = String.fromCharCode.apply(null, encodedData);
			const utf8Decoder = new TextDecoder();
			const text = utf8Decoder.decode(encodedData);

			// ===== 统计 / 智能去重 / 质量过滤（KV SETTINGS 或环境变量控制，默认关） =====
			const keywords = await loadFilterKeywords(env, settings);
			const rawLines = text.split('\n').filter(line => line.trim() !== '');
			const rawCount = rawLines.length;

			let stageLines;
			if (dedupEnabled) {
				// 按 server+port+协议 生成唯一标识去重，保留第一个出现的节点
				stageLines = dedupNodesByKey(rawLines);
			} else {
				// 未开启 DEDUP 时保持与原版完全一致：整行 Set 去重
				stageLines = [...new Set(text.split('\n'))];
			}
			const afterDedupCount = stageLines.filter(line => line.trim() !== '').length;

			// 质量过滤：排除节点名包含指定关键词的节点（如「过期」「到期」「试用」）
			let finalLines = stageLines;
			if (keywords.length) {
				finalLines = finalLines.filter(line => !shouldFilterNode(line, keywords));
			}
			const finalCount = finalLines.filter(line => line.trim() !== '').length;
			const filteredCount = afterDedupCount - finalCount;

			//去重（结果供后续 base64 编码与格式转换使用）
			const result = finalLines.join('\n');
			//console.log(result);

			// ===== 新增：汇聚日志写入 KV（ENABLE_LOGS=true 时启用，最多保留 100 条，自动清理旧记录） =====
			// token===fakeToken 为订阅转换后端的内部回调，跳过以免一次请求产生重复日志
			if (logsEnabled && token !== fakeToken) {
				await writeAggLog(env, {
					ts: new Date().toISOString(),          // 时间戳
					sources: 订阅链接数组.length,            // 汇聚的订阅源数量
					raw: rawCount,                          // 原始节点总数
					deduped: afterDedupCount,               // 去重后节点数
					filtered: filteredCount,                // 过滤掉的节点数
					final: finalCount,                      // 最终输出节点数
					format: 订阅格式,                        // 请求的订阅格式
					dedup: dedupEnabled,                    // 本次是否开启智能去重
					filter: keywords.length > 0,             // 本次是否开启关键词过滤
				});
			}

			let base64Data;
			try {
				base64Data = btoa(result);
			} catch (e) {
				function encodeBase64(data) {
					const binary = new TextEncoder().encode(data);
					let base64 = '';
					const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

					for (let i = 0; i < binary.length; i += 3) {
						const byte1 = binary[i];
						const byte2 = binary[i + 1] || 0;
						const byte3 = binary[i + 2] || 0;

						base64 += chars[byte1 >> 2];
						base64 += chars[((byte1 & 3) << 4) | (byte2 >> 4)];
						base64 += chars[((byte2 & 15) << 2) | (byte3 >> 6)];
						base64 += chars[byte3 & 63];
					}

					const padding = 3 - (binary.length % 3 || 3);
					return base64.slice(0, base64.length - padding) + '=='.slice(0, padding);
				}

				base64Data = encodeBase64(result)
			}

			// 构建响应头对象
			const responseHeaders = {
				"content-type": "text/plain; charset=utf-8",
				"Profile-Update-Interval": `${SUBUpdateTime}`,
				"Profile-web-page-url": request.url.includes('?') ? request.url.split('?')[0] : request.url,
				//"Subscription-Userinfo": `upload=${UD}; download=${UD}; total=${total}; expire=${expire}`,
			};

			if (订阅格式 == 'base64' || token == fakeToken) {
				return new Response(base64Data, { headers: responseHeaders });
			} else if (订阅格式 == 'clash') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=clash&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
			} else if (订阅格式 == 'singbox') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=singbox&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
			} else if (订阅格式 == 'surge') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=surge&ver=4&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;
			} else if (订阅格式 == 'quanx') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=quanx&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&udp=true`;
			} else if (订阅格式 == 'loon') {
				subConverterUrl = `${subProtocol}://${subConverter}/sub?target=loon&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false`;
			}
			//console.log(订阅转换URL);
			try {
				const subConverterResponse = await fetch(subConverterUrl, { headers: { 'User-Agent': userAgentHeader } });//订阅转换
				if (!subConverterResponse.ok) return new Response(base64Data, { headers: responseHeaders });
				let subConverterContent = await subConverterResponse.text();
				if (订阅格式 == 'clash') {
					subConverterContent = await clashFix(subConverterContent);
					// ===== 新增：Clash YAML 输出级去重与关键词过滤（随 DEDUP / FILTER_KEYWORDS 开关生效） =====
					// 同时清理 proxy-groups 等处对被移除节点名的引用，避免客户端解析报错
					if (dedupEnabled || keywords.length) {
						subConverterContent = processClashYaml(subConverterContent, { dedup: dedupEnabled, keywords });
					}
				}
				// 只有非浏览器订阅才会返回SUBNAME
				if (!userAgent.includes('mozilla')) responseHeaders["Content-Disposition"] = `attachment; filename*=utf-8''${encodeURIComponent(FileName)}`;
				return new Response(subConverterContent, { headers: responseHeaders });
			} catch (error) {
				return new Response(base64Data, { headers: responseHeaders });
			}
		}
	}
};

async function ADD(envadd) {
	var addtext = envadd.replace(/[	"'|\r\n]+/g, '\n').replace(/\n+/g, '\n');	// 替换为换行
	//console.log(addtext);
	if (addtext.charAt(0) == '\n') addtext = addtext.slice(1);
	if (addtext.charAt(addtext.length - 1) == '\n') addtext = addtext.slice(0, addtext.length - 1);
	const add = addtext.split('\n');
	//console.log(add);
	return add;
}

async function nginx() {
	const text = `
	<!DOCTYPE html>
	<html>
	<head>
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and
	working. Further configuration is required.</p>
	
	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>
	
	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`
	return text;
}

async function sendMessage(type, ip, add_data = "") {
	if (BotToken !== '' && ChatID !== '') {
		let msg = "";
		const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
		if (response.status == 200) {
			const ipInfo = await response.json();
			msg = `${type}\nIP: ${ip}\n国家: ${ipInfo.country}\n<tg-spoiler>城市: ${ipInfo.city}\n组织: ${ipInfo.org}\nASN: ${ipInfo.as}\n${add_data}`;
		} else {
			msg = `${type}\nIP: ${ip}\n<tg-spoiler>${add_data}`;
		}

		let url = "https://api.telegram.org/bot" + BotToken + "/sendMessage?chat_id=" + ChatID + "&parse_mode=HTML&text=" + encodeURIComponent(msg);
		return fetch(url, {
			method: 'get',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;',
				'Accept-Encoding': 'gzip, deflate, br',
				'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
			}
		});
	}
}

function base64Decode(str) {
	const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(bytes);
}

async function MD5MD5(text) {
	const encoder = new TextEncoder();

	const firstPass = await crypto.subtle.digest('MD5', encoder.encode(text));
	const firstPassArray = Array.from(new Uint8Array(firstPass));
	const firstHex = firstPassArray.map(b => b.toString(16).padStart(2, '0')).join('');

	const secondPass = await crypto.subtle.digest('MD5', encoder.encode(firstHex.slice(7, 27)));
	const secondPassArray = Array.from(new Uint8Array(secondPass));
	const secondHex = secondPassArray.map(b => b.toString(16).padStart(2, '0')).join('');

	return secondHex.toLowerCase();
}

function clashFix(content) {
	if (content.includes('wireguard') && !content.includes('remote-dns-resolve')) {
		let lines;
		if (content.includes('\r\n')) {
			lines = content.split('\r\n');
		} else {
			lines = content.split('\n');
		}

		let result = "";
		for (let line of lines) {
			if (line.includes('type: wireguard')) {
				const 备改内容 = `, mtu: 1280, udp: true`;
				const 正确内容 = `, mtu: 1280, remote-dns-resolve: true, udp: true`;
				result += line.replace(new RegExp(备改内容, 'g'), 正确内容) + '\n';
			} else {
				result += line + '\n';
			}
		}

		content = result;
	}
	return content;
}

async function proxyURL(proxyURL, url) {
	const URLs = await ADD(proxyURL);
	const fullURL = URLs[Math.floor(Math.random() * URLs.length)];

	// 解析目标 URL
	let parsedURL = new URL(fullURL);
	console.log(parsedURL);
	// 提取并可能修改 URL 组件
	let URLProtocol = parsedURL.protocol.slice(0, -1) || 'https';
	let URLHostname = parsedURL.hostname;
	let URLPathname = parsedURL.pathname;
	let URLSearch = parsedURL.search;

	// 处理 pathname
	if (URLPathname.charAt(URLPathname.length - 1) == '/') {
		URLPathname = URLPathname.slice(0, -1);
	}
	URLPathname += url.pathname;

	// 构建新的 URL
	let newURL = `${URLProtocol}://${URLHostname}${URLPathname}${URLSearch}`;

	// 反向代理请求
	let response = await fetch(newURL);

	// 创建新的响应
	let newResponse = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});

	// 添加自定义头部，包含 URL 信息
	//newResponse.headers.set('X-Proxied-By', 'Cloudflare Worker');
	//newResponse.headers.set('X-Original-URL', fullURL);
	newResponse.headers.set('X-New-URL', newURL);

	return newResponse;
}

async function getSUB(api, request, 追加UA, userAgentHeader) {
	if (!api || api.length === 0) {
		return [];
	} else api = [...new Set(api)]; // 去重
	let newapi = "";
	let 订阅转换URLs = "";
	let 异常订阅 = "";
	const controller = new AbortController(); // 创建一个AbortController实例，用于取消请求
	const timeout = setTimeout(() => {
		controller.abort(); // 2秒后取消所有请求
	}, 2000);

	try {
		// 使用Promise.allSettled等待所有API请求完成，无论成功或失败
		const responses = await Promise.allSettled(api.map(apiUrl => getUrl(request, apiUrl, 追加UA, userAgentHeader).then(response => response.ok ? response.text() : Promise.reject(response))));

		// 遍历所有响应
		const modifiedResponses = responses.map((response, index) => {
			// 检查是否请求成功
			if (response.status === 'rejected') {
				const reason = response.reason;
				if (reason && reason.name === 'AbortError') {
					return {
						status: '超时',
						value: null,
						apiUrl: api[index] // 将原始的apiUrl添加到返回对象中
					};
				}
				console.error(`请求失败: ${api[index]}, 错误信息: ${reason.status} ${reason.statusText}`);
				return {
					status: '请求失败',
					value: null,
					apiUrl: api[index] // 将原始的apiUrl添加到返回对象中
				};
			}
			return {
				status: response.status,
				value: response.value,
				apiUrl: api[index] // 将原始的apiUrl添加到返回对象中
			};
		});

		console.log(modifiedResponses); // 输出修改后的响应数组

		for (const response of modifiedResponses) {
			// 检查响应状态是否为'fulfilled'
			if (response.status === 'fulfilled') {
				const content = await response.value || 'null'; // 获取响应的内容
				if (content.includes('proxies:')) {
					//console.log('Clash订阅: ' + response.apiUrl);
					订阅转换URLs += "|" + response.apiUrl; // Clash 配置
				} else if (content.includes('outbounds"') && content.includes('inbounds"')) {
					//console.log('Singbox订阅: ' + response.apiUrl);
					订阅转换URLs += "|" + response.apiUrl; // Singbox 配置
				} else if (content.includes('://')) {
					//console.log('明文订阅: ' + response.apiUrl);
					newapi += content + '\n'; // 追加内容
				} else if (isValidBase64(content)) {
					//console.log('Base64订阅: ' + response.apiUrl);
					newapi += base64Decode(content) + '\n'; // 解码并追加内容
				} else {
					const 异常订阅LINK = `trojan://CMLiussss@127.0.0.1:8888?security=tls&allowInsecure=1&type=tcp&headerType=none#%E5%BC%82%E5%B8%B8%E8%AE%A2%E9%98%85%20${response.apiUrl.split('://')[1].split('/')[0]}`;
					console.log('异常订阅: ' + 异常订阅LINK);
					异常订阅 += `${异常订阅LINK}\n`;
				}
			}
		}
	} catch (error) {
		console.error(error); // 捕获并输出错误信息
	} finally {
		clearTimeout(timeout); // 清除定时器
	}

	const 订阅内容 = await ADD(newapi + 异常订阅); // 将处理后的内容转换为数组
	// 返回处理后的结果
	return [订阅内容, 订阅转换URLs];
}

async function getUrl(request, targetUrl, 追加UA, userAgentHeader) {
	// 设置自定义 User-Agent
	const newHeaders = new Headers(request.headers);
	newHeaders.set("User-Agent", `${atob('djJyYXlOLzYuNDU=')} cmliu/CF-Workers-SUB ${追加UA}(${userAgentHeader})`);

	// 构建新的请求对象
	const modifiedRequest = new Request(targetUrl, {
		method: request.method,
		headers: newHeaders,
		body: request.method === "GET" ? null : request.body,
		redirect: "follow",
		cf: {
			// 忽略SSL证书验证
			insecureSkipVerify: true,
			// 允许自签名证书
			allowUntrusted: true,
			// 禁用证书验证
			validateCertificate: false
		}
	});

	// 输出请求的详细信息
	console.log(`请求URL: ${targetUrl}`);
	console.log(`请求头: ${JSON.stringify([...newHeaders])}`);
	console.log(`请求方法: ${request.method}`);
	console.log(`请求体: ${request.method === "GET" ? null : request.body}`);

	// 发送请求并返回响应
	return fetch(modifiedRequest);
}

function isValidBase64(str) {
	// 先移除所有空白字符(空格、换行、回车等)
	const cleanStr = str.replace(/\s/g, '');
	const base64Regex = /^[A-Za-z0-9+/=]+$/;
	return base64Regex.test(cleanStr);
}

async function 迁移地址列表(env, txt = 'ADD.txt') {
	const 旧数据 = await env.KV.get(`/${txt}`);
	const 新数据 = await env.KV.get(txt);

	if (旧数据 && !新数据) {
		// 写入新位置
		await env.KV.put(txt, 旧数据);
		// 删除旧数据
		await env.KV.delete(`/${txt}`);
		return true;
	}
	return false;
}

async function KV(request, env, txt = 'ADD.txt', guest) {
	const url = new URL(request.url);
	try {
		// POST请求处理
		if (request.method === "POST") {
			if (!env.KV) return new Response("未绑定KV空间", { status: 400 });
			try {
				const content = await request.text();
				await env.KV.put(txt, content);
				return new Response("保存成功");
			} catch (error) {
				console.error('保存KV时发生错误:', error);
				return new Response("保存失败: " + error.message, { status: 500 });
			}
		}

		// GET请求部分
		let content = '';
		let hasKV = !!env.KV;

		if (hasKV) {
			try {
				content = await env.KV.get(txt) || '';
			} catch (error) {
				console.error('读取KV时发生错误:', error);
				content = '读取数据时发生错误: ' + error.message;
			}
		}

		const html = `
			<!DOCTYPE html>
			<html>
				<head>
					<title>${FileName} 订阅编辑</title>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<style>
						body {
							margin: 0;
							padding: 15px; /* 调整padding */
							box-sizing: border-box;
							font-size: 13px; /* 设置全局字体大小 */
						}
						.editor-container {
							width: 100%;
							max-width: 100%;
							margin: 0 auto;
						}
						.editor {
							width: 100%;
							height: 300px; /* 调整高度 */
							margin: 15px 0; /* 调整margin */
							padding: 10px; /* 调整padding */
							box-sizing: border-box;
							border: 1px solid #ccc;
							border-radius: 4px;
							font-size: 13px;
							line-height: 1.5;
							overflow-y: auto;
							resize: none;
						}
						.save-container {
							margin-top: 8px; /* 调整margin */
							display: flex;
							align-items: center;
							gap: 10px; /* 调整gap */
						}
						.save-btn, .back-btn {
							padding: 6px 15px; /* 调整padding */
							color: white;
							border: none;
							border-radius: 4px;
							cursor: pointer;
						}
						.save-btn {
							background: #4CAF50;
						}
						.save-btn:hover {
							background: #45a049;
						}
						.back-btn {
							background: #666;
						}
						.back-btn:hover {
							background: #555;
						}
						.save-status {
							color: #666;
						}
					</style>
					<script src="https://cdn.jsdelivr.net/npm/@keeex/qrcodejs-kx@1.0.2/qrcode.min.js"></script>
				</head>
				<body>
					################################################################<br>
					Subscribe / sub 订阅地址, 点击链接自动 <strong>复制订阅链接</strong> 并 <strong>生成订阅二维码</strong> <br>
					---------------------------------------------------------------<br>
					自适应订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sub','qrcode_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}</a><br>
					<div id="qrcode_0" style="margin: 10px 10px 10px 10px;"></div>
					Base64订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?b64','qrcode_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?b64</a><br>
					<div id="qrcode_1" style="margin: 10px 10px 10px 10px;"></div>
					clash订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?clash','qrcode_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?clash</a><br>
					<div id="qrcode_2" style="margin: 10px 10px 10px 10px;"></div>
					singbox订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sb','qrcode_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?sb</a><br>
					<div id="qrcode_3" style="margin: 10px 10px 10px 10px;"></div>
					surge订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?surge','qrcode_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?surge</a><br>
					<div id="qrcode_4" style="margin: 10px 10px 10px 10px;"></div>
					loon订阅地址:<br>
					<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?loon','qrcode_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?loon</a><br>
					<div id="qrcode_5" style="margin: 10px 10px 10px 10px;"></div>
					&nbsp;&nbsp;<strong><a href="javascript:void(0);" id="noticeToggle" onclick="toggleNotice()">查看访客订阅∨</a></strong><br>
					<div id="noticeContent" class="notice-content" style="display: none;">
						---------------------------------------------------------------<br>
						访客订阅只能使用订阅功能，无法查看配置页！<br>
						GUEST（访客订阅TOKEN）: <strong>${guest}</strong><br>
						---------------------------------------------------------------<br>
						自适应订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}','guest_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}</a><br>
						<div id="guest_0" style="margin: 10px 10px 10px 10px;"></div>
						Base64订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&b64','guest_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&b64</a><br>
						<div id="guest_1" style="margin: 10px 10px 10px 10px;"></div>
						clash订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&clash','guest_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&clash</a><br>
						<div id="guest_2" style="margin: 10px 10px 10px 10px;"></div>
						singbox订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&sb','guest_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&sb</a><br>
						<div id="guest_3" style="margin: 10px 10px 10px 10px;"></div>
						surge订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&surge','guest_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&surge</a><br>
						<div id="guest_4" style="margin: 10px 10px 10px 10px;"></div>
						loon订阅地址:<br>
						<a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guest}&loon','guest_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guest}&loon</a><br>
						<div id="guest_5" style="margin: 10px 10px 10px 10px;"></div>
					</div>
					---------------------------------------------------------------<br>
					################################################################<br>
					订阅转换配置<br>
					---------------------------------------------------------------<br>
					SUBAPI（订阅转换后端）: <strong>${subProtocol}://${subConverter}</strong><br>
					SUBCONFIG（订阅转换配置文件）: <strong>${subConfig}</strong><br>
					---------------------------------------------------------------<br>
					################################################################<br>
					${FileName} 汇聚订阅编辑: 
					<div class="editor-container">
						${hasKV ? `
						<textarea class="editor" 
							placeholder="${decodeURIComponent(atob('TElOSyVFNyVBNCVCQSVFNCVCRSU4QiVFRiVCQyU4OCVFNCVCOCU4MCVFOCVBMSU4QyVFNCVCOCU4MCVFNCVCOCVBQSVFOCU4QSU4MiVFNyU4MiVCOSVFOSU5MyVCRSVFNiU4RSVBNSVFNSU4RCVCMyVFNSU4RiVBRiVFRiVCQyU4OSVFRiVCQyU5QQp2bGVzcyUzQSUyRiUyRjI0NmFhNzk1LTA2MzctNGY0Yy04ZjY0LTJjOGZiMjRjMWJhZCU0MDEyNy4wLjAuMSUzQTEyMzQlM0ZlbmNyeXB0aW9uJTNEbm9uZSUyNnNlY3VyaXR5JTNEdGxzJTI2c25pJTNEVEcuQ01MaXVzc3NzLmxvc2V5b3VyaXAuY29tJTI2YWxsb3dJbnNlY3VyZSUzRDElMjZ0eXBlJTNEd3MlMjZob3N0JTNEVEcuQ01MaXVzc3NzLmxvc2V5b3VyaXAuY29tJTI2cGF0aCUzRCUyNTJGJTI1M0ZlZCUyNTNEMjU2MCUyM0NGbmF0CnRyb2phbiUzQSUyRiUyRmFhNmRkZDJmLWQxY2YtNGE1Mi1iYTFiLTI2NDBjNDFhNzg1NiU0MDIxOC4xOTAuMjMwLjIwNyUzQTQxMjg4JTNGc2VjdXJpdHklM0R0bHMlMjZzbmklM0RoazEyLmJpbGliaWxpLmNvbSUyNmFsbG93SW5zZWN1cmUlM0QxJTI2dHlwZSUzRHRjcCUyNmhlYWRlclR5cGUlM0Rub25lJTIzSEsKc3MlM0ElMkYlMkZZMmhoWTJoaE1qQXRhV1YwWmkxd2IyeDVNVE13TlRveVJYUlFjVzQyU0ZscVZVNWpTRzlvVEdaVmNFWlJkMjVtYWtORFVUVnRhREZ0U21SRlRVTkNkV04xVjFvNVVERjFaR3RTUzBodVZuaDFielUxYXpGTFdIb3lSbTgyYW5KbmRERTRWelkyYjNCMGVURmxOR0p0TVdwNlprTm1RbUklMjUzRCU0MDg0LjE5LjMxLjYzJTNBNTA4NDElMjNERQoKCiVFOCVBRSVBMiVFOSU5OCU4NSVFOSU5MyVCRSVFNiU4RSVBNSVFNyVBNCVCQSVFNCVCRSU4QiVFRiVCQyU4OCVFNCVCOCU4MCVFOCVBMSU4QyVFNCVCOCU4MCVFNiU5RCVBMSVFOCVBRSVBMiVFOSU5OCU4NSVFOSU5MyVCRSVFNiU4RSVBNSVFNSU4RCVCMyVFNSU4RiVBRiVFRiVCQyU4OSVFRiVCQyU5QQpodHRwcyUzQSUyRiUyRnN1Yi54Zi5mcmVlLmhyJTJGYXV0bw=='))}"
							id="content">${content}</textarea>
						<div class="save-container">
							<button class="save-btn" onclick="saveContent(this)">保存</button>
							<span class="save-status" id="saveStatus"></span>
						</div>
						` : '<p>请绑定 <strong>变量名称</strong> 为 <strong>KV</strong> 的KV命名空间</p>'}
					</div>
					<br>
					################################################################<br>
					${decodeURIComponent(atob('dGVsZWdyYW0lMjAlRTQlQkElQTQlRTYlQjUlODElRTclQkUlQTQlMjAlRTYlOEElODAlRTYlOUMlQUYlRTUlQTQlQTclRTQlQkQlQUMlN0UlRTUlOUMlQTglRTclQkElQkYlRTUlOEYlOTElRTclODklOEMhJTNDYnIlM0UKJTNDYSUyMGhyZWYlM0QlMjdodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlMjclM0VodHRwcyUzQSUyRiUyRnQubWUlMkZDTUxpdXNzc3MlM0MlMkZhJTNFJTNDYnIlM0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJTNDYnIlM0UKZ2l0aHViJTIwJUU5JUExJUI5JUU3JTlCJUFFJUU1JTlDJUIwJUU1JTlEJTgwJTIwU3RhciFTdGFyIVN0YXIhISElM0NiciUzRQolM0NhJTIwaHJlZiUzRCUyN2h0dHBzJTNBJTJGJTJGZ2l0aHViLmNvbSUyRmNtbGl1JTJGQ0YtV29ya2Vycy1TVUIlMjclM0VodHRwcyUzQSUyRiUyRmdpdGh1Yi5jb20lMkZjbWxpdSUyRkNGLVdvcmtlcnMtU1VCJTNDJTJGYSUzRSUzQ2JyJTNFCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSUzQ2JyJTNFCiUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMyUyMw=='))}
					<br><br>UA: <strong>${request.headers.get('User-Agent')}</strong>
					<script>
					function copyToClipboard(text, qrcode) {
						navigator.clipboard.writeText(text).then(() => {
							alert('已复制到剪贴板');
						}).catch(err => {
							console.error('复制失败:', err);
						});
						const qrcodeDiv = document.getElementById(qrcode);
						qrcodeDiv.innerHTML = '';
						new QRCode(qrcodeDiv, {
							text: text,
							width: 220, // 调整宽度
							height: 220, // 调整高度
							colorDark: "#000000", // 二维码颜色
							colorLight: "#ffffff", // 背景颜色
							correctLevel: QRCode.CorrectLevel.Q, // 设置纠错级别
							scale: 1 // 调整像素颗粒度
						});
					}
						
					if (document.querySelector('.editor')) {
						let timer;
						const textarea = document.getElementById('content');
						const originalContent = textarea.value;
		
						function goBack() {
							const currentUrl = window.location.href;
							const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
							window.location.href = parentUrl;
						}
		
						function replaceFullwidthColon() {
							const text = textarea.value;
							textarea.value = text.replace(/：/g, ':');
						}
						
						function saveContent(button) {
							try {
								const updateButtonText = (step) => {
									button.textContent = \`保存中: \${step}\`;
								};
								// 检测是否为iOS设备
								const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
								
								// 仅在非iOS设备上执行replaceFullwidthColon
								if (!isIOS) {
									replaceFullwidthColon();
								}
								updateButtonText('开始保存');
								button.disabled = true;

								// 获取textarea内容和原始内容
								const textarea = document.getElementById('content');
								if (!textarea) {
									throw new Error('找不到文本编辑区域');
								}

								updateButtonText('获取内容');
								let newContent;
								let originalContent;
								try {
									newContent = textarea.value || '';
									originalContent = textarea.defaultValue || '';
								} catch (e) {
									console.error('获取内容错误:', e);
									throw new Error('无法获取编辑内容');
								}

								updateButtonText('准备状态更新函数');
								const updateStatus = (message, isError = false) => {
									const statusElem = document.getElementById('saveStatus');
									if (statusElem) {
										statusElem.textContent = message;
										statusElem.style.color = isError ? 'red' : '#666';
									}
								};

								updateButtonText('准备按钮重置函数');
								const resetButton = () => {
									button.textContent = '保存';
									button.disabled = false;
								};

								if (newContent !== originalContent) {
									updateButtonText('发送保存请求');
									fetch(window.location.href, {
										method: 'POST',
										body: newContent,
										headers: {
											'Content-Type': 'text/plain;charset=UTF-8'
										},
										cache: 'no-cache'
									})
									.then(response => {
										updateButtonText('检查响应状态');
										if (!response.ok) {
											throw new Error(\`HTTP error! status: \${response.status}\`);
										}
										updateButtonText('更新保存状态');
										const now = new Date().toLocaleString();
										document.title = \`编辑已保存 \${now}\`;
										updateStatus(\`已保存 \${now}\`);
									})
									.catch(error => {
										updateButtonText('处理错误');
										console.error('Save error:', error);
										updateStatus(\`保存失败: \${error.message}\`, true);
									})
									.finally(() => {
										resetButton();
									});
								} else {
									updateButtonText('检查内容变化');
									updateStatus('内容未变化');
									resetButton();
								}
							} catch (error) {
								console.error('保存过程出错:', error);
								button.textContent = '保存';
								button.disabled = false;
								const statusElem = document.getElementById('saveStatus');
								if (statusElem) {
									statusElem.textContent = \`错误: \${error.message}\`;
									statusElem.style.color = 'red';
								}
							}
						}
		
						textarea.addEventListener('blur', saveContent);
						textarea.addEventListener('input', () => {
							clearTimeout(timer);
							timer = setTimeout(saveContent, 5000);
						});
					}

					function toggleNotice() {
						const noticeContent = document.getElementById('noticeContent');
						const noticeToggle = document.getElementById('noticeToggle');
						if (noticeContent.style.display === 'none' || noticeContent.style.display === '') {
							noticeContent.style.display = 'block';
							noticeToggle.textContent = '隐藏访客订阅∧';
						} else {
							noticeContent.style.display = 'none';
							noticeToggle.textContent = '查看访客订阅∨';
						}
					}
			
					// 初始化 noticeContent 的 display 属性
					document.addEventListener('DOMContentLoaded', () => {
						document.getElementById('noticeContent').style.display = 'none';
					});
					</script>
				</body>
			</html>
		`;

		return new Response(html, {
			headers: { "Content-Type": "text/html;charset=utf-8" }
		});
	} catch (error) {
		console.error('处理请求时发生错误:', error);
		return new Response("服务器错误: " + error.message, {
			status: 500,
			headers: { "Content-Type": "text/plain;charset=utf-8" }
		});
	}
}

// ============================================================
// 新增功能：节点去重 / 质量过滤 / 汇聚日志 / 健康检查
// （全部由环境变量控制，默认关闭，不影响未配置的用户）
// ============================================================

/**
 * 解析布尔型环境变量。
 * 1 / true / yes / on（忽略大小写）视为开启，其余（含空）视为关闭。
 * @param {string|boolean|undefined|null} value 环境变量或设置原始值
 * @returns {boolean}
 */
export function isTrueEnv(value) {
	if (value === true) return true;
	if (value === false || value === null || value === undefined || value === '') return false;
	return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

/** 控制台动态设置在 KV 中的键名（JSON 对象） */
const SETTINGS_KEY = 'SETTINGS';

/**
 * 读取控制台动态设置（KV 键 SETTINGS，JSON 对象）。读取失败返回 {}。
 * @param {object} env Worker 环境
 * @returns {Promise<object>}
 */
export async function loadSettings(env) {
	if (!env || !env.KV) return {};
	try {
		const raw = await env.KV.get(SETTINGS_KEY);
		if (!raw) return {};
		const obj = JSON.parse(raw);
		return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
	} catch (e) {
		console.error('读取 SETTINGS 失败，回退环境变量:', e);
		return {};
	}
}

/**
 * 保存控制台设置到 KV（整体覆盖 SETTINGS 键）。
 * @param {object} env Worker 环境
 * @param {object} obj 设置对象
 * @returns {Promise<void>}
 */
export async function saveSettings(env, obj) {
	if (!env || !env.KV) throw new Error('KV not bound');
	await env.KV.put(SETTINGS_KEY, JSON.stringify(obj || {}));
}

/**
 * 解析功能开关：页面/KV SETTINGS > 环境变量 > 默认值。
 * @param {object} settings loadSettings 结果
 * @param {string} key 设置名（如 DEDUP、ENABLE_LOGS）
 * @param {string|undefined} envVal 对应环境变量
 * @param {boolean} defaultVal 两者皆未配置时的默认值
 * @returns {boolean}
 */
export function resolveFlag(settings, key, envVal, defaultVal) {
	if (settings && Object.prototype.hasOwnProperty.call(settings, key)) {
		return isTrueEnv(settings[key]);
	}
	if (envVal !== undefined && envVal !== null && envVal !== '') {
		return isTrueEnv(envVal);
	}
	return !!defaultVal;
}

/**
 * 解析过滤关键词列表。支持三种格式：
 * - 逗号/中文逗号/换行分隔的纯文本：`过期,到期,试用`
 * - JSON 数组：`["过期","到期"]`
 * - 空值：返回空数组（表示不过滤）
 * 返回值统一小写并去重，便于不区分大小写匹配。
 * @param {string|string[]|null|undefined} raw 关键词原始内容
 * @returns {string[]}
 */
export function parseKeywordList(raw) {
	if (raw === null || raw === undefined) return [];
	let parts;
	if (Array.isArray(raw)) {
		parts = raw.map(x => String(x));
	} else {
		const text = String(raw).trim();
		if (!text) return [];
		if (text.startsWith('[')) {
			try {
				const arr = JSON.parse(text);
				parts = Array.isArray(arr) ? arr.map(x => String(x)) : [text];
			} catch (e) {
				parts = text.split(/[,，\n]/);
			}
		} else {
			parts = text.split(/[,，\n]/);
		}
	}
	const out = [];
	const seen = new Set();
	for (let p of parts) {
		p = String(p).trim().toLowerCase();
		if (!p || seen.has(p)) continue;
		seen.add(p);
		out.push(p);
	}
	return out;
}

/**
 * 加载节点过滤关键词。
 * 优先级：控制台 SETTINGS.FILTER_KEYWORDS > KV 键 FILTER_KEYWORDS > 环境变量 FILTER_KEYWORDS。
 * 任一层显式存在（含空字符串）即生效，可临时关闭过滤。
 * @param {object} env Worker 环境（含可选的 KV 绑定）
 * @param {object} [settings] 已加载的 SETTINGS（可选，避免重复读）
 * @returns {Promise<string[]>} 小写关键词数组，空数组表示过滤未启用
 */
export async function loadFilterKeywords(env, settings) {
	if (settings && Object.prototype.hasOwnProperty.call(settings, 'FILTER_KEYWORDS')) {
		return parseKeywordList(settings.FILTER_KEYWORDS);
	}
	let raw = null;
	if (env && env.KV) {
		try {
			raw = await env.KV.get('FILTER_KEYWORDS');
		} catch (e) {
			console.error('读取 KV 过滤关键词失败，回退环境变量:', e);
			raw = null;
		}
	}
	if (raw === null || raw === undefined) raw = (env && env.FILTER_KEYWORDS) || '';
	return parseKeywordList(raw);
}

/**
 * Base64 解码为 UTF-8 文本（兼容 URL-safe 字母表与缺失 padding）。
 * @param {string} str base64 字符串
 * @returns {string} 解码后的文本
 */
function decodeBase64Utf8(str) {
	let s = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
	while (s.length % 4 !== 0) s += '=';
	const binary = atob(s);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder('utf-8').decode(bytes);
}

/**
 * 为一行明文节点生成去重唯一标识：`协议|server|port`（统一小写）。
 * 覆盖常见格式：ss / vmess / vless / trojan / hysteria2 / tuic / socks 等 URI 节点，
 * 以及 vmess 的 Base64(JSON) 与 ss 旧版全 Base64 格式。
 * 解析失败时回退为「原始整行」，等价于旧行为的整行去重，保证不会误删。
 * @param {string} line 单行节点链接
 * @returns {string} 去重键
 */
export function getNodeKey(line) {
	// rapid trim: slice only when leading/trailing whitespace exists
	let s = typeof line === 'string' ? line : String(line);
	const len = s.length;
	if (len) {
		let a = 0, b = len;
		while (a < b) { const c = s.charCodeAt(a); if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break; a++; }
		while (b > a) { const c = s.charCodeAt(b - 1); if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break; b--; }
		if (a || b < len) s = s.slice(a, b);
	}

	// protocol prefix: indexOf + char class, faster than full-line regex
	const protoEnd = s.indexOf('://');
	if (protoEnd <= 0) return `\u0000raw:${s}`;
	let proto = '';
	for (let i = 0; i < protoEnd; i++) {
		const c = s.charCodeAt(i);
		const ok =
			(c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
			c === 43 || c === 45 || c === 46;
		if (!ok) return `\u0000raw:${s}`;
		proto += s.charAt(i);
	}
	proto = proto.toLowerCase();
	let rest = s.slice(protoEnd + 3);

	// special: vmess:// followed by Base64(JSON) config
	if (proto === 'vmess') {
		try {
			const obj = JSON.parse(decodeBase64Utf8(rest));
			const host = String(obj.add || '').trim().toLowerCase();
			const port = String(obj.port || '').trim();
			if (host) return `${proto}|${host}|${port}`;
		} catch (e) { /* parse failure -> fallback */ }
		return `\u0000raw:${s}`;
	}

	// generic URI: strip #fragment, take authority after last @
	let authority = rest;
	const hash = authority.indexOf('#');
	if (hash >= 0) authority = authority.slice(0, hash);

	let at = authority.lastIndexOf('@');
	if (at >= 0) {
		authority = authority.slice(at + 1);
	} else if (proto === 'ss') {
		// legacy ss://BASE64(method:pass@host:port) without @ separator
		try {
			const decoded = decodeBase64Utf8(authority.split('?')[0]);
			at = decoded.lastIndexOf('@');
			if (at >= 0) authority = decoded.slice(at + 1);
		} catch (e) { /* keep as-is */ }
	}

	const q = authority.indexOf('?');
	if (q >= 0) authority = authority.slice(0, q);
	const slash = authority.indexOf('/');
	if (slash >= 0) authority = authority.slice(0, slash);

	let host = '';
	let port = '';
	if (authority.charCodeAt(0) === 91) { // [
		const rb = authority.indexOf(']');
		if (rb > 0 && authority.charCodeAt(rb + 1) === 58) { // :
			host = authority.slice(1, rb).toLowerCase();
			port = authority.slice(rb + 2);
		} else {
			host = authority.toLowerCase();
		}
	} else {
		const colon = authority.lastIndexOf(':');
		if (colon > 0) {
			const p = authority.slice(colon + 1);
			let allDigits = p.length > 0;
			for (let i = 0; i < p.length; i++) {
				const c = p.charCodeAt(i);
				if (c < 48 || c > 57) { allDigits = false; break; }
			}
			if (allDigits) {
				host = authority.slice(0, colon).toLowerCase();
				port = p;
			} else {
				host = authority.toLowerCase();
			}
		} else {
			host = authority.toLowerCase();
		}
	}
	if (!host) return `\u0000raw:${s}`;
	return `${proto}|${host}|${port}`;
}

/**
 * 按「协议+server+port」对明文节点列表去重，保留每个键第一次出现的行。
 * @param {string[]} lines 已去除空行的节点列表
 * @returns {string[]} 去重后的节点列表（保持原有顺序）
 */
export function dedupNodesByKey(lines) {
	const seen = new Set();
	const out = [];
	for (const line of lines) {
		const key = getNodeKey(line);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(line);
	}
	return out;
}

/**
 * 提取节点名称（用于关键词过滤）。
 * - 普通 URI：取 # 后的片段并做 URI 解码
 * - vmess：取 JSON 中的 ps 字段
 * - 无名称时回退整行，保证关键词仍可能命中
 * @param {string} line 单行节点链接
 * @returns {string} 节点名称（或回退的整行文本）
 */
export function getNodeName(line) {
	const s = String(line).trim();
	const protoMatch = s.match(/^([A-Za-z0-9+.-]+):\/\//);
	if (!protoMatch) return s;
	const proto = protoMatch[1].toLowerCase();
	if (proto === 'vmess') {
		try {
			const obj = JSON.parse(decodeBase64Utf8(s.slice(protoMatch[0].length)));
			if (obj.ps) return String(obj.ps);
		} catch (e) { /* 回退整行 */ }
		return s;
	}
	const hash = s.indexOf('#');
	if (hash >= 0 && hash < s.length - 1) {
		const frag = s.slice(hash + 1);
		try {
			return decodeURIComponent(frag);
		} catch (e) {
			return frag;
		}
	}
	return s;
}

/**
 * 判断节点是否应被过滤（节点名包含任意关键词，不区分大小写）。
 * @param {string} line 单行节点链接
 * @param {string[]} keywords 小写关键词数组（由 parseKeywordList 产出）
 * @returns {boolean} true 表示应剔除
 */
export function shouldFilterNode(line, keywords) {
	if (!keywords || !keywords.length) return false;
	const name = getNodeName(line).toLowerCase();
	for (const k of keywords) {
		if (k && name.includes(k)) return true;
	}
	return false;
}

/**
 * 去除 YAML 标量值两侧的单/双引号。
 * @param {string} v 原始值
 * @returns {string}
 */
function stripYamlQuotes(v) {
	const s = String(v);
	if (s.length >= 2) {
		if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
			return s.slice(1, -1);
		}
	}
	return s;
}

/**
 * 解析单个 Clash proxy 条目（一组以 `- ` 开头的行）的关键字段。
 * port 支持裸数字与单/双引号（`port: "443"`），统一 strip 引号后参与去重键，
 * 避免「引号端口 vs 裸端口」因键不一致而漏去重。
 * @param {string[]} entryLines 条目内的所有行
 * @returns {{name:string, key:string}|null} 无法识别 server 时返回 null（原样保留）
 */
export function extractClashProxyMeta(entryLines) {
	let name = '';
	let type = '';
	let server = '';
	let port = '';
	for (const line of entryLines) {
		let m;
		if ((m = line.match(/^\s*-\s+name:\s*(.+?)\s*$/))) name = stripYamlQuotes(m[1]);
		else if ((m = line.match(/^\s+type:\s*(.+?)\s*$/))) type = stripYamlQuotes(m[1]);
		else if ((m = line.match(/^\s+server:\s*(.+?)\s*$/))) server = stripYamlQuotes(m[1]);
		else if ((m = line.match(/^\s+port:\s*(.+?)\s*$/))) port = stripYamlQuotes(m[1]);
	}
	if (!server) return null;
	return { name, key: `${type.toLowerCase()}|${server.toLowerCase()}|${port}` };
}

/**
 * 对 Clash YAML 输出的 proxies 段做去重与关键词过滤。
 * 去重键与明文节点一致：`type|server|port`，保留第一个出现的条目；
 * 被移除条目的名称会同时从 proxy-groups 等处的 `- 成员名` 引用行中清理，
 * 避免客户端因引用不存在的代理而启动失败。
 * 无法识别的条目（缺 server 等）原样保留，保证不误删。
 * @param {string} yaml Clash YAML 文本
 * @param {{dedup?:boolean, keywords?:string[]}} opts dedup 是否启用去重；keywords 过滤关键词（小写）
 * @returns {string} 处理后的 YAML（开关全关或无 proxies 段时原样返回）
 */
export function processClashYaml(yaml, opts) {
	const dedup = !!(opts && opts.dedup);
	const keywords = (opts && opts.keywords) || [];
	if (!yaml || (!dedup && !keywords.length)) return yaml;

	const lines = yaml.split('\n');
	// 定位顶层 proxies: 段（列 0，允许行尾注释）
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/^proxies:\s*(#.*)?$/.test(lines[i])) {
			start = i;
			break;
		}
	}
	if (start < 0) return yaml;

	// 段结束于下一个顶层键（非空且不以空白开头的行）
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (lines[i].trim() !== '' && !/^\s/.test(lines[i])) {
			end = i;
			break;
		}
	}

	const prefix = lines.slice(0, start + 1);
	const body = lines.slice(start + 1, end);
	const suffix = lines.slice(end);

	// 将 proxies 段内容切分为：段首杂项行 + 以 `- ` 开头的独立条目
	const pre = [];
	const chunks = [];
	let cur = null;
	let entryIndent = null;
	for (const line of body) {
		const blank = line.trim() === '';
		const m = line.match(/^(\s*)-\s+/);
		if (!blank && m && (entryIndent === null || m[1].length === entryIndent)) {
			if (entryIndent === null) entryIndent = m[1].length;
			if (cur) chunks.push(cur);
			cur = [line];
			continue;
		}
		if (cur) cur.push(line);
		else pre.push(line);
	}
	if (cur) chunks.push(cur);

	const seen = new Set();
	const droppedNames = new Set();
	const outBody = pre.slice();
	for (const chunk of chunks) {
		const meta = extractClashProxyMeta(chunk);
		let dropAsDup = false;
		let dropAsFilter = false;
		if (meta) {
			if (dedup) {
				// 与明文管线一致：先按 type|server|port 判定去重（首见者占位，
				// 即使随后被关键词过滤，后续同端点条目仍视为重复）
				if (seen.has(meta.key)) dropAsDup = true;
				else seen.add(meta.key);
			}
			if (!dropAsDup && keywords.length && meta.name) {
				const nl = meta.name.toLowerCase();
				for (const k of keywords) {
					if (k && nl.includes(k)) {
						dropAsFilter = true;
						break;
					}
				}
			}
		}
		if (dropAsDup || dropAsFilter) {
			// 记录被移除的名称，用于清理 proxy-groups 等处的成员引用
			if (meta && meta.name) droppedNames.add(meta.name);
			continue;
		}
		outBody.push(...chunk);
	}

	// 清理对已移除节点的成员引用（形如 `      - 节点名` 的纯列表项）。
	// 引用可能出现在 proxies 段之后的 proxy-groups / fallback 等任意段落，
	// 因此对「prefix + body + suffix」拼接后的完整输出统一清理。
	let fullOut = [...prefix, ...outBody, ...suffix];
	if (droppedNames.size) {
		fullOut = fullOut.filter(line => {
			const m = line.match(/^\s*-\s+(.+?)\s*$/);
			if (!m) return true;
			// proxy 条目首行形如 `- name: xxx`，不会与裸成员名相等，保留
			return !droppedNames.has(stripYamlQuotes(m[1]));
		});
	}

	return fullOut.join('\n');
}

/** 汇聚日志在 KV 中保留的最大条数（超出后自动删除最旧记录） */
const MAX_AGG_LOGS = 100;

/**
 * 汇聚日志单条记录的 KV 键前缀。
 * 键格式：log:<15位时间戳>:<6位随机> —— 字典序即时间序（旧→新）。
 * 每条独立 put，写路径无共享读改写状态，避免并发汇聚时的日志丢失竞态。
 */
const AGG_LOG_PREFIX = 'log:';

/** 旧版单键数组日志的键名（只读兼容，新写入不再使用） */
const LEGACY_AGG_LOGS_KEY = 'LOGS';

/**
 * 生成一条日志的唯一 KV 键（时间戳 + 随机后缀，保证并发不撞键）。
 * @param {number} [now] 可注入的时间戳（测试用）
 * @returns {string}
 */
function aggLogKey(now) {
	const ts = String(now === undefined ? Date.now() : now).padStart(15, '0');
	const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
	return AGG_LOG_PREFIX + ts + ':' + rand;
}

/**
 * 清理旧日志：list 前缀下全部键（字典序=旧→新），超过 MAX_AGG_LOGS 时删除最旧的。
 * 每次写入后调用一次；失败不影响本次写入。
 * @param {object} env Worker 环境
 * @returns {Promise<void>}
 */
async function pruneAggLogs(env) {
	try {
		const listed = await env.KV.list({ prefix: AGG_LOG_PREFIX, limit: MAX_AGG_LOGS * 4 });
		const keys = listed && listed.keys ? listed.keys : [];
		if (keys.length <= MAX_AGG_LOGS) return;
		// 字典序升序 = 最旧在前，删除超出部分
		const excess = keys.slice(0, keys.length - MAX_AGG_LOGS);
		await Promise.all(excess.map(k => env.KV.delete(k.name)));
	} catch (e) {
		console.error('清理汇聚日志失败（不影响本次写入）:', e);
	}
}

/**
 * 将一次汇聚的统计信息写入 KV 日志。
 * 实现：每条日志独立键（AGG_LOG_PREFIX + 时间戳 + 随机）put，随后裁剪到 MAX_AGG_LOGS 条。
 * 相比旧版单键 JSON 数组读改写，写入之间无共享状态，并发请求不会互相覆盖。
 * 已知限制：Cloudflare KV 为最终一致（同 colo 通常亚秒可见），极端情况下 list 可能短暂滞后。
 * @param {object} env Worker 环境（需绑定 KV）
 * @param {object} entry 日志条目（ts/sources/raw/deduped/filtered/final 等）
 * @returns {Promise<void>}
 */
export async function writeAggLog(env, entry) {
	if (!env || !env.KV) return;
	try {
		await env.KV.put(aggLogKey(), JSON.stringify(entry));
		await pruneAggLogs(env);
	} catch (e) {
		// 日志写入失败不影响订阅返回
		console.error('写入汇聚日志失败:', e);
	}
}

/**
 * 读取全部汇聚日志（新→旧排序）。
 * 优先读独立键列表；兼容旧版单键 LOGS 数组（合并到尾部作历史数据）。
 * @param {object} env Worker 环境
 * @returns {Promise<object[]>}
 */
export async function readAggLogs(env) {
	if (!env || !env.KV) return [];
	const logs = [];
	// 独立键：list 升序（旧→新），读取后反转为新→旧
	try {
		const listed = await env.KV.list({ prefix: AGG_LOG_PREFIX, limit: MAX_AGG_LOGS * 4 });
		const keys = (listed && listed.keys ? listed.keys : []).slice().reverse();
		const values = await Promise.all(keys.map(k => env.KV.get(k.name)));
		for (const v of values) {
			if (!v) continue;
			try {
				const obj = JSON.parse(v);
				if (obj && typeof obj === 'object') logs.push(obj);
			} catch (e) { /* 跳过损坏条目 */ }
		}
	} catch (e) {
		console.error('读取汇聚日志键列表失败:', e);
	}
	// 旧版 LOGS 数组（若有）追加到历史尾部
	try {
		const legacy = await env.KV.get(LEGACY_AGG_LOGS_KEY);
		if (legacy) {
			const arr = JSON.parse(legacy);
			if (Array.isArray(arr)) logs.push(...arr);
		}
	} catch (e) { /* 忽略旧格式解析失败 */ }
	return logs;
}

/**
 * 生成健康检查 JSON 体（控制台概览与 /health 共用）。
 * @param {Request} request
 * @param {object} env
 * @param {object} features
 * @param {object} [settings]
 * @returns {Promise<{body:object, ok:boolean}>}
 */
export async function buildHealthBody(request, env, features, settings) {
	const kv = { bound: !!(env && env.KV), status: 'unbound' };
	if (env && env.KV) {
		try {
			await env.KV.get('__HEALTH__');
			kv.status = 'ok';
		} catch (e) {
			kv.status = 'error';
			kv.error = e.message;
		}
	}
	let keywords = [];
	if (kv.status !== 'error') {
		try {
			keywords = await loadFilterKeywords(env, settings);
		} catch (e) { /* 忽略 */ }
	}
	const ok = kv.status !== 'error';
	const body = {
		status: ok ? 'ok' : 'error',
		time: new Date().toISOString(),
		kv,
		features: {
			dedup: !!(features && features.dedup),
			filter: keywords.length > 0,
			logs: !!(features && features.logs),
			admin: !!(features && features.admin),
			health: !!(features && features.health),
		},
		filterKeywordCount: keywords.length,
	};
	if (request.cf && request.cf.colo) body.colo = request.cf.colo;
	return { body, ok };
}

/**
 * GET /health 健康检查（探活用 JSON；开关 ENABLE_HEALTH 默认开）。
 * 人工查看请走单页控制台 /admin。
 * @param {Request} request
 * @param {object} env
 * @param {object} features
 * @param {object} [settings]
 * @returns {Promise<Response>}
 */
export async function handleHealth(request, env, features, settings) {
	const { body, ok } = await buildHealthBody(request, env, features, settings);
	return new Response(JSON.stringify(body, null, 2), {
		status: ok ? 200 : 503,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
}

/**
 * 鉴权：?token= 或 Authorization: Bearer，需等于 ADMIN_TOKEN（未设回退 TOKEN）。
 * @returns {{ok:boolean, adminToken:string, provided:string}}
 */
function checkAdminAuth(request, env, url) {
	const adminToken = (env && env.ADMIN_TOKEN) || mytoken;
	const authHeader = request.headers.get('Authorization') || '';
	const provided = url.searchParams.get('token')
		|| (authHeader.replace(/^Bearer\s+/i, '').trim())
		|| '';
	return { ok: !!adminToken && provided === adminToken, adminToken, provided };
}

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function jsonError(status, obj) {
	return new Response(JSON.stringify(obj, null, 2), { status, headers: JSON_HEADERS });
}

/**
 * 读取汇聚日志 JSON（控制台与 /admin/logs 共用）。
 * @returns {Promise<Response>}
 */
async function logsJsonResponse(request, env, url) {
	const auth = checkAdminAuth(request, env, url);
	if (!auth.ok) {
		return jsonError(401, {
			error: 'unauthorized',
			hint: '请携带 ?token=ADMIN_TOKEN 或 Authorization: Bearer ADMIN_TOKEN（未设置 ADMIN_TOKEN 时使用 TOKEN）',
		});
	}
	if (!env || !env.KV) return jsonError(503, { error: 'KV not bound', logs: [] });
	let logs;
	try {
		logs = await readAggLogs(env);
	} catch (e) {
		return jsonError(500, { error: 'log read error: ' + e.message, logs: [] });
	}
	let limit = parseInt(url.searchParams.get('limit') || String(MAX_AGG_LOGS), 10);
	if (!Number.isFinite(limit)) limit = MAX_AGG_LOGS;
	limit = Math.min(Math.max(limit, 1), MAX_AGG_LOGS);
	const sliced = logs.slice(0, limit);
	return new Response(JSON.stringify({
		count: sliced.length,
		total: logs.length,
		max: MAX_AGG_LOGS,
		logs: sliced,
	}, null, 2), { headers: JSON_HEADERS });
}

/**
 * GET /admin/logs 兼容别名（等价 ?api=logs）。
 * @param {Request} request
 * @param {object} env
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function handleAdminLogs(request, env, url) {
	return logsJsonResponse(request, env, url);
}

/**
 * 单页控制台：GET /admin 返回 HTML；同路径 API：
 * - ?api=health   状态 JSON（需登录）
 * - ?api=logs     汇聚日志 JSON（需登录）
 * - ?api=settings 读取 SETTINGS（需登录）
 * - POST ?api=settings  保存 SETTINGS（需登录，body 为 JSON 对象）
 * 未登录时 HTML 为登录表单；token 与 ?token= 相同，成功后由前端存 sessionStorage。
 * @param {Request} request
 * @param {object} env
 * @param {URL} url
 * @param {object} features
 * @param {object} settings
 * @returns {Promise<Response>}
 */
export async function handleAdmin(request, env, url, features, settings) {
	const api = url.searchParams.get('api');
	const auth = checkAdminAuth(request, env, url);

	if (api === 'health') {
		if (!auth.ok) return jsonError(401, { error: 'unauthorized' });
		const { body, ok } = await buildHealthBody(request, env, features, settings);
		return new Response(JSON.stringify(body, null, 2), { status: ok ? 200 : 503, headers: JSON_HEADERS });
	}
	if (api === 'logs') {
		return logsJsonResponse(request, env, url);
	}
	if (api === 'settings') {
		if (!auth.ok) return jsonError(401, { error: 'unauthorized' });
		if (request.method === 'POST' || request.method === 'PUT') {
			if (!env || !env.KV) return jsonError(503, { error: 'KV not bound' });
			try {
				const bodyText = await request.text();
				let obj = bodyText ? JSON.parse(bodyText) : {};
				if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
					return jsonError(400, { error: 'body must be a JSON object' });
				}
				// 白名单：只接受已知键
				const allowed = ['DEDUP', 'ENABLE_LOGS', 'ENABLE_HEALTH', 'ENABLE_ADMIN', 'FILTER_KEYWORDS'];
				const cleaned = {};
				for (const k of allowed) {
					if (Object.prototype.hasOwnProperty.call(obj, k)) {
						cleaned[k] = k === 'FILTER_KEYWORDS' ? String(obj[k]) : isTrueEnv(obj[k]);
					} else if (settings && Object.prototype.hasOwnProperty.call(settings, k)) {
						cleaned[k] = settings[k];
					}
				}
				await saveSettings(env, cleaned);
				return new Response(JSON.stringify({ ok: true, settings: cleaned }, null, 2), { headers: JSON_HEADERS });
			} catch (e) {
				return jsonError(400, { error: e.message });
			}
		}
		// GET settings：合并展示（默认 + env 解析结果 + KV 覆盖）
		const merged = {
			DEDUP: dedupEnabledFrom(features),
			ENABLE_LOGS: !!(features && features.logs),
			ENABLE_HEALTH: !!(features && features.health),
			ENABLE_ADMIN: !!(features && features.admin),
			FILTER_KEYWORDS: settings && Object.prototype.hasOwnProperty.call(settings, 'FILTER_KEYWORDS')
				? String(settings.FILTER_KEYWORDS)
				: '',
		};
		if (!Object.prototype.hasOwnProperty.call(settings || {}, 'FILTER_KEYWORDS')) {
			try {
				const kws = await loadFilterKeywords(env, settings);
				merged.FILTER_KEYWORDS = kws.join(',');
			} catch (e) { /* keep */ }
		}
		const kvOverride = {};
		if (settings) {
			for (const k of Object.keys(settings)) kvOverride[k] = settings[k];
		}
		return new Response(JSON.stringify({ settings: merged, kvOverride, envFallback: true }, null, 2), { headers: JSON_HEADERS });
	}

	// HTML 页面
	const needsAuth = !auth.ok;
	return new Response(adminHtml(needsAuth), {
		status: needsAuth ? 401 : 200,
		headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

function dedupEnabledFrom(features) {
	return !!(features && features.dedup);
}

/**
 * 控制台单页 HTML（登录 + 三 Tab：概览 / 日志 / 设置）。
 * @param {boolean} showLogin 未鉴权时只渲染登录框
 * @returns {string}
 */
function adminHtml(showLogin) {
	const title = 'SUB 控制台';
	if (showLogin) {
		return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#0f1419;--card:#1a2332;--fg:#e7ecf3;--mut:#8b9bb4;--acc:#3b82f6;--ok:#22c55e;--bad:#ef4444}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
.wrap{max-width:960px;margin:48px auto;padding:0 16px}
.card{background:var(--card);border-radius:12px;padding:24px;box-shadow:0 8px 24px #0006}
h1{margin:0 0 8px;font-size:20px}.m{color:var(--mut);margin-bottom:16px}
input[type=password],input[type=text]{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #2a3a52;background:#0c1118;color:var(--fg);font-size:14px}
button{margin-top:12px;padding:10px 16px;border:0;border-radius:8px;background:var(--acc);color:#fff;font-size:14px;cursor:pointer}
.err{color:var(--bad);margin-top:8px;min-height:1.2em}
</style></head><body><div class="wrap"><div class="card">
<h1>${title}</h1><p class="m">请输入管理 Token（ADMIN_TOKEN，未设置时为 TOKEN）</p>
<input id="t" type="password" placeholder="Token" autofocus>
<div class="err" id="e"></div>
<button id="b">进入控制台</button>
</div></div>
<script>
document.getElementById('b').onclick=async()=>{
  const t=document.getElementById('t').value.trim();
  if(!t){document.getElementById('e').textContent='请输入 Token';return}
  const r=await fetch(location.pathname+'?api=health&token='+encodeURIComponent(t));
  if(r.ok||r.status===503){sessionStorage.setItem('admin_token',t);location.href=location.pathname}
  else document.getElementById('e').textContent='Token 无效';
};
document.getElementById('t').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('b').click()});
</script></body></html>`;
	}
	return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#0f1419;--card:#1a2332;--fg:#e7ecf3;--mut:#8b9bb4;--acc:#3b82f6;--ok:#22c55e;--bad:#ef4444;--line:#2a3a52}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card)}
header b{font-size:16px}header .sp{flex:1}
nav{display:flex;gap:4px;padding:12px 20px 0}
nav button{padding:8px 14px;border:0;border-radius:8px 8px 0 0;background:transparent;color:var(--mut);cursor:pointer;font-size:14px}
nav button.on{background:var(--card);color:var(--fg)}
main{padding:16px 20px 40px;max-width:1100px}
.panel{display:none;background:var(--card);border-radius:0 12px 12px 12px;padding:20px;min-height:240px}
.panel.on{display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.st{background:#0c1118;border:1px solid var(--line);border-radius:10px;padding:12px}
.st .k{color:var(--mut);font-size:12px}.st .v{font-size:20px;font-weight:600;margin-top:4px}
.ok{color:var(--ok)}.bad{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:500}
.mut{color:var(--mut)}
label.row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
label.row input[type=checkbox]{width:18px;height:18px}
label.row span{flex:1}
textarea{width:100%;min-height:72px;background:#0c1118;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px;font:13px/1.4 ui-monospace,monospace}
.btns{margin-top:16px;display:flex;gap:10px;align-items:center}
button.pri{padding:10px 16px;border:0;border-radius:8px;background:var(--acc);color:#fff;cursor:pointer}
button.gh{padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--mut);cursor:pointer}
.msg{font-size:13px}.msg.ok{color:var(--ok)}.msg.bad{color:var(--bad)}
.hint{color:var(--mut);font-size:12px;margin-top:8px}
code{background:#0c1118;padding:1px 6px;border-radius:4px;font-size:12px}
</style></head><body>
<header><b>SUB 控制台</b><span class="sp"></span><span class="mut" id="clock"></span>
<button class="gh" id="logout">退出</button></header>
<nav>
  <button data-t="ov" class="on">概览</button>
  <button data-t="lg">日志</button>
  <button data-t="st">设置</button>
</nav>
<main>
<section class="panel on" id="p-ov">
  <div class="grid" id="cards"></div>
  <p class="hint">JSON 同源接口：<code>/admin?api=health</code> · 探活别名 <code>/health</code></p>
  <div class="btns"><button class="pri" id="reloadH">刷新</button><span class="msg" id="hm"></span></div>
</section>
<section class="panel" id="p-lg">
  <div class="btns" style="margin-top:0;margin-bottom:12px">
    <button class="pri" id="reloadL">刷新</button>
    <span class="msg" id="lm"></span>
    <span class="mut" id="lcount"></span>
  </div>
  <div style="overflow:auto">
  <table><thead><tr><th>时间</th><th>源</th><th>raw</th><th>去重</th><th>过滤</th><th>final</th><th>格式</th><th>开关</th></tr></thead>
  <tbody id="lbody"><tr><td colspan="8" class="mut">加载中…</td></tr></tbody></table>
  </div>
  <p class="hint">最多保留 100 条；写入键前缀 <code>log:</code>。JSON：<code>/admin?api=logs</code></p>
</section>
<section class="panel" id="p-st">
  <label class="row"><input type="checkbox" id="s_DEDUP"><span>智能去重 <code>DEDUP</code><br><span class="mut">按 协议+server+port，明文与 Clash 生效</span></span></label>
  <label class="row"><input type="checkbox" id="s_ENABLE_LOGS"><span>写入汇聚日志 <code>ENABLE_LOGS</code><br><span class="mut">每次汇总统计写入 KV，滚动 100 条</span></span></label>
  <label class="row"><input type="checkbox" id="s_ENABLE_HEALTH" checked><span>启用 /health <code>ENABLE_HEALTH</code><br><span class="mut">监控探活 JSON</span></span></label>
  <label class="row"><input type="checkbox" id="s_ENABLE_ADMIN" checked><span>启用控制台 <code>ENABLE_ADMIN</code><br><span class="mut">关闭后 /admin 与 /admin/logs 不再拦截</span></span></label>
  <div style="margin-top:16px">
    <div class="mut" style="margin-bottom:6px">过滤关键词 <code>FILTER_KEYWORDS</code>（逗号分隔，空为关闭）</div>
    <textarea id="s_FILTER_KEYWORDS" placeholder="过期,到期,试用"></textarea>
  </div>
  <div class="btns">
    <button class="pri" id="saveS">保存到 KV</button>
    <button class="gh" id="reloadS">重新加载</button>
    <span class="msg" id="sm"></span>
  </div>
  <p class="hint">保存写入 KV 键 <code>SETTINGS</code>，优先级高于环境变量，无需重新部署。需绑定 KV。</p>
</section>
</main>
<script>
const tk = sessionStorage.getItem('admin_token') || '';
const qs = (o={}) => { const u=new URLSearchParams(o); if(tk) u.set('token',tk); return u.toString(); };
const api = async (name, opts) => {
  const r = await fetch(location.pathname + '?' + qs({api:name, ...(opts&&opts.query||{})}), opts&&opts.init);
  if (r.status===401){ sessionStorage.removeItem('admin_token'); location.href=location.pathname; throw new Error('auth'); }
  return r;
};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// tabs
document.querySelectorAll('nav button').forEach(b=>{
  b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
    document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+b.dataset.t));
    if(b.dataset.t==='ov') loadH(); if(b.dataset.t==='lg') loadL(); if(b.dataset.t==='st') loadS();};
});
document.getElementById('logout').onclick=()=>{sessionStorage.removeItem('admin_token');location.href=location.pathname};
async function loadH(){
  const el=document.getElementById('cards'), m=document.getElementById('hm');
  try{
    const j=await (await api('health')).json();
    const f=j.features||{};
    el.innerHTML=[
      ['状态', j.status, j.status==='ok'?'ok':'bad'],
      ['KV', j.kv&&(j.kv.status||j.kv.bound), j.kv&&j.kv.status==='ok'?'ok':''],
      ['colo', j.colo||'—',''],
      ['去重', f.dedup?'开':'关', f.dedup?'ok':''],
      ['过滤', f.filter?'开':'关',''],
      ['日志', f.logs?'开':'关',''],
      ['关键词数', j.filterKeywordCount, ''],
    ].map(([k,v,c])=>'<div class="st"><div class="k">'+esc(k)+'</div><div class="v '+c+'">'+esc(v)+'</div></div>').join('');
    m.textContent=''; m.className='msg';
  }catch(e){m.textContent=String(e);m.className='msg bad'}
}
async function loadL(){
  const tb=document.getElementById('lbody'), m=document.getElementById('lm'), c=document.getElementById('lcount');
  try{
    const j=await (await api('logs')).json();
    const rows=j.logs||[];
    c.textContent = '共 '+j.count+'/'+j.total+' 条';
    if(!rows.length){tb.innerHTML='<tr><td colspan="8" class="mut">暂无日志（请在设置中打开「写入汇聚日志」并访问一次订阅）</td></tr>';return}
    tb.innerHTML=rows.map(l=>'<tr><td>'+esc(l.ts||'')+'</td><td>'+esc(l.sources)+'</td><td>'+esc(l.raw)+'</td><td>'+esc(l.deduped)+'</td><td>'+esc(l.filtered)+'</td><td>'+esc(l.final)+'</td><td>'+esc(l.format||'')+'</td><td>'+(l.dedup?'D':'')+(l.filter?'F':'')+'</td></tr>').join('');
    m.textContent=''; 
  }catch(e){m.textContent=String(e);m.className='msg bad'}
}
async function loadS(){
  const m=document.getElementById('sm');
  try{
    const j=await (await api('settings')).json();
    const s=j.settings||{};
    document.getElementById('s_DEDUP').checked=!!s.DEDUP;
    document.getElementById('s_ENABLE_LOGS').checked=!!s.ENABLE_LOGS;
    document.getElementById('s_ENABLE_HEALTH').checked=!!s.ENABLE_HEALTH;
    document.getElementById('s_ENABLE_ADMIN').checked=!!s.ENABLE_ADMIN;
    document.getElementById('s_FILTER_KEYWORDS').value=s.FILTER_KEYWORDS||'';
    m.textContent = Object.keys(j.kvOverride||{}).length ? '已加载（含 KV 覆盖）' : '';
    m.className='msg ok';
  }catch(e){m.textContent=String(e);m.className='msg bad'}
}
async function saveS(){
  const m=document.getElementById('sm');
  const body={
    DEDUP:document.getElementById('s_DEDUP').checked,
    ENABLE_LOGS:document.getElementById('s_ENABLE_LOGS').checked,
    ENABLE_HEALTH:document.getElementById('s_ENABLE_HEALTH').checked,
    ENABLE_ADMIN:document.getElementById('s_ENABLE_ADMIN').checked,
    FILTER_KEYWORDS:document.getElementById('s_FILTER_KEYWORDS').value.trim(),
  };
  try{
    const r=await api('settings',{init:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}});
    const j=await r.json();
    if(j.ok){m.textContent='已保存到 KV，立即生效';m.className='msg ok';}
    else{m.textContent=j.error||'保存失败';m.className='msg bad';}
  }catch(e){m.textContent=String(e);m.className='msg bad'}
}
document.getElementById('saveS').onclick=saveS;
document.getElementById('reloadS').onclick=loadS;
document.getElementById('reloadH').onclick=loadH;
document.getElementById('reloadL').onclick=loadL;
document.getElementById('clock').textContent=new Date().toLocaleString();
loadH(); loadS();
</script>
</body></html>`;
}
